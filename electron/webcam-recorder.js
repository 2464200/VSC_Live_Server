'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const START_TIMEOUT_MS = 12000;
const STOP_TIMEOUT_MS = 12000;

function sanitize(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim();
}

function formatTimestamp(date = new Date()) {
  const compact = date.toISOString().replace(/[-:T]/g, '').replace(/\..+/, '');
  return `${compact}${String(date.getMilliseconds()).padStart(3, '0')}`;
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.signalCode) {
      resolve(true);
      return;
    }

    let settled = false;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeListener('exit', onExit);
      child.removeListener('error', onError);
      resolve(exited);
    };
    const onExit = () => finish(true);
    const onError = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    child.once('exit', onExit);
    child.once('error', onError);
  });
}

function createWebcamRecorder({ recordingDir, ffmpegCandidates = [] } = {}) {
  const outputDir = path.resolve(String(recordingDir || ''));
  let active = null;
  let operation = null;
  let lastError = '';

  const resolveFfmpeg = () => ffmpegCandidates
    .map((candidate) => String(candidate || '').trim())
    .find((candidate) => candidate && fs.existsSync(candidate)) || '';

  const getState = () => ({
    ok: true,
    recordingDir: outputDir,
    recording: {
      recording: Boolean(active?.child && active.child.exitCode === null && !active.child.signalCode),
      status: operation || (active?.child && active.child.exitCode === null && !active.child.signalCode ? 'recording' : (active ? 'error' : 'idle')),
      pid: active?.child?.pid || null,
      startedAt: active?.startedAt || 0,
      filePath: active?.sourceFilePath || '',
      sourceFilePath: active?.sourceFilePath || '',
      targetFilePath: active?.targetFilePath || '',
      recordingMode: active ? 'native-then-mp4' : '',
      error: lastError
    }
  });

  const start = async (payload = {}) => {
    if (active?.child && (active.child.exitCode !== null || active.child.signalCode) && !operation) {
      active = null;
    }
    if (active || operation) {
      throw new Error('Registrazione già attiva o in fase di finalizzazione.');
    }

    const ffmpegPath = resolveFfmpeg();
    if (!ffmpegPath) {
      throw new Error('FFmpeg non trovato. Configura FFMPEG_PATH o installalo in C:/FFMPEG/bin.');
    }
    const cameraName = sanitize(payload.cameraName);
    if (!cameraName) throw new Error('Seleziona una webcam prima di avviare la registrazione.');

    fs.mkdirSync(outputDir, { recursive: true });
    const timestamp = formatTimestamp();
    const uniqueTimestamp = `${timestamp}-${process.pid}`;
    const sourceFileName = `${uniqueTimestamp}.mkv`;
    const targetFileName = `${uniqueTimestamp}.mp4`;
    const sourceFilePath = path.join(outputDir, sourceFileName);
    const targetFilePath = path.join(outputDir, targetFileName);
    const fps = sanitize(payload.fps);
    const args = ['-hide_banner', '-loglevel', 'info', '-stats_period', '0.5', '-y', '-f', 'dshow', '-rtbufsize', '64M'];
    if (/^\d{1,3}$/.test(fps)) args.push('-framerate', fps);
    args.push(
      '-i', `video=${cameraName}`,
      '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-f', 'matroska', sourceFilePath
    );

    lastError = '';
    operation = 'starting';
    let child;
    try {
      child = spawn(ffmpegPath, args, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
    } catch (error) {
      operation = null;
      throw error;
    }

    const recording = {
      child,
      startedAt: Date.now(),
      sourceFileName,
      sourceFilePath,
      targetFileName,
      targetFilePath,
      stderr: '',
      firstFrame: false,
      startError: null
    };
    active = recording;

    child.stderr?.on('data', (chunk) => {
      recording.stderr = `${recording.stderr}${chunk.toString()}`.slice(-24000);
      if (/frame=\s*[1-9]\d*/.test(recording.stderr)) recording.firstFrame = true;
    });
    child.once('error', (error) => {
      recording.startError = error;
      lastError = error.message;
    });
    child.once('exit', (code, signal) => {
      recording.exitCode = code;
      recording.exitSignal = signal;
      if (active === recording && operation !== 'finalizing') {
        operation = null;
        if (code !== 0) {
          lastError = recording.stderr.trim().slice(-1800) || `FFmpeg è terminato con codice ${code ?? signal ?? 'sconosciuto'}.`;
        }
      }
    });

    const started = await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearInterval(probe);
        clearTimeout(timeout);
        child.removeListener('exit', onExit);
        if (error) reject(error);
        else resolve(true);
      };
      const onExit = (code, signal) => {
        const detail = recording.stderr.trim().slice(-1800);
        finish(new Error(detail || `FFmpeg non ha avviato la webcam (codice ${code ?? signal ?? 'sconosciuto'}).`));
      };
      const probe = setInterval(() => {
        if (recording.firstFrame) finish();
        else if (recording.startError) finish(recording.startError);
      }, 100);
      const timeout = setTimeout(() => {
        const detail = recording.stderr.trim().slice(-1800);
        finish(new Error(detail || 'Timeout: FFmpeg non ha ricevuto immagini dalla webcam.'));
      }, START_TIMEOUT_MS);
      child.once('exit', onExit);
    }).catch(async (error) => {
      if (child.pid && child.exitCode === null && !child.signalCode) {
        try { child.stdin?.write('q\n'); } catch (_) {}
        if (!(await waitForExit(child, 1500))) {
          child.kill();
          await waitForExit(child, 5000);
        }
      }
      operation = null;
      if (active === recording && (!child.pid || child.exitCode !== null || child.signalCode)) active = null;
      lastError = error.message;
      throw error;
    });

    if (started) operation = 'recording';
    return {
      ok: true,
      recording: true,
      recordingMode: 'native-then-mp4',
      pid: child.pid,
      startedAt: recording.startedAt,
      fileName: targetFileName,
      filePath: targetFilePath,
      filePathSource: sourceFilePath,
      sourceFileName,
      sourceFilePath,
      targetFileName,
      targetFilePath,
      recordingDir: outputDir
    };
  };

  const stop = async () => {
    if (operation === 'starting') throw new Error('La webcam si sta aprendo; attendere il risultato di AVVIA REGISTRAZIONE prima dello STOP.');
    if (operation === 'finalizing') {
      let waits = 0;
      while (operation === 'finalizing' && waits < 2500) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        waits += 1;
      }
      if (operation === 'finalizing') throw new Error('La finalizzazione MP4 è ancora in corso.');
      return { ok: true, stopped: false, recordingDir: outputDir };
    }
    const recording = active;
    if (!recording) return { ok: true, stopped: false, recordingDir: outputDir };
    operation = 'finalizing';
    const durationMs = Math.max(0, Date.now() - recording.startedAt);
    try {
      let graceful = false;
      if (recording.child.exitCode === null && !recording.child.signalCode) {
        try { recording.child.stdin?.write('q\n'); } catch (_) {}
        graceful = await waitForExit(recording.child, STOP_TIMEOUT_MS);
        if (!graceful) {
          recording.child.kill();
          if (!(await waitForExit(recording.child, 5000))) {
            throw new Error('FFmpeg non si è arrestato dopo il comando STOP; riprovare lo STOP prima di riavviare.');
          }
        }
      }

      if (!fs.existsSync(recording.sourceFilePath) || fs.statSync(recording.sourceFilePath).size < 1024) {
        throw new Error(recording.stderr.trim().slice(-1800) || 'La webcam non ha prodotto un file video valido.');
      }

      const temporaryMp4 = `${recording.targetFilePath}.partial`;
      try { fs.rmSync(temporaryMp4, { force: true }); } catch (_) {}
      try {
        await execFileAsync(resolveFfmpeg(), [
          '-hide_banner', '-loglevel', 'error', '-y',
          '-i', recording.sourceFilePath,
          '-map', '0:v:0', '-c:v', 'copy', '-movflags', '+faststart', '-f', 'mp4', temporaryMp4
        ], { windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
        if (!fs.existsSync(temporaryMp4) || fs.statSync(temporaryMp4).size < 1024) {
          throw new Error('FFmpeg non ha creato un file MP4 valido.');
        }
        await execFileAsync(resolveFfmpeg(), [
          '-hide_banner', '-v', 'error', '-i', temporaryMp4,
          '-map', '0:v:0', '-f', 'null', '-'
        ], { windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
        fs.renameSync(temporaryMp4, recording.targetFilePath);
      } catch (error) {
        try { fs.rmSync(temporaryMp4, { force: true }); } catch (_) {}
        throw new Error(`Finalizzazione MP4 non riuscita. Registrazione sorgente conservata in ${recording.sourceFilePath}. ${error.message}`);
      }

      const stats = fs.statSync(recording.targetFilePath);
      try { fs.rmSync(recording.sourceFilePath, { force: true }); } catch (_) {}
      lastError = '';
      return {
        ok: true,
        stopped: true,
        recordingMode: 'native-then-mp4',
        startedAt: recording.startedAt,
        durationMs,
        filePath: recording.targetFilePath,
        finalFilePath: recording.targetFilePath,
        finalFileName: recording.targetFileName,
        sourceFilePath: recording.sourceFilePath,
        targetFilePath: recording.targetFilePath,
        fileVerified: true,
        fileSizeBytes: stats.size,
        graceful: graceful && recording.child.exitCode === 0,
        conversion: { ok: true, verified: true, method: 'remux-h264' },
        recordingDir: outputDir
      };
    } catch (error) {
      lastError = error.message;
      throw error;
    } finally {
      operation = null;
      if (recording.child.exitCode !== null || recording.child.signalCode || !recording.child.pid) active = null;
    }
  };

  const stopForShutdown = async () => {
    let startupWaits = 0;
    while (operation === 'starting' && startupWaits < 130) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      startupWaits += 1;
    }
    if (!active) return;
    try {
      await stop();
    } catch (error) {
      console.error('[webcam-recorder] stop on shutdown failed:', error.message);
      if (active?.child && active.child.exitCode === null) active.child.kill();
      active = null;
      operation = null;
    }
  };

  return { start, stop, getState, stopForShutdown };
}

module.exports = { createWebcamRecorder };
