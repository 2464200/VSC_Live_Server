#!/usr/bin/env node
/**
 * UNIFIED SERVER - Server consolidato su porta 5500
 *
 * Combina tutte le funzionalità:
 * - Server statico per file HTML/CSS/JS
 * - API PDF (lista, apertura, chiusura viewer)
 * - API Eventi (brani, log, export)
 * - Gestione automatica ciclo di vita PDF
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');
const net = require('net');
const os = require('os');
const { parse: parseCsv } = require('csv-parse/sync');
const QRCodeLib = require('qrcode');
const { syncBraniJson, appendExtraBrano, updateExtraBrano, deleteExtraBrano, EXTRA_CSV_NAME, ensureExtraCsvFile } = require('./Eventi/brani-utils');
const { syncAll: syncGoogleSheetsData } = require('./Bordero/server/google-sheets-sync');
const { parseBorderoGoogleSyncIntervalMs, shouldScheduleBorderoGoogleSync } = require('./Bordero/server/bordero-sync-config');

const app = express();
let PORT = process.env.UNIFIED_PORT ? parseInt(process.env.UNIFIED_PORT, 10) : 5500;
const PDF_FOLDER = 'C:\\VSC_SCRIPT_PDF';
const VIDEOCLIP_DIR = process.env.VSC_VIDEOCLIP_PATH || 'C:\\VSC_VIDEOCLIP';
const SIAE_EXPORT_DIR = 'C:\\VSC_SIAE';
const USERFORM_CAMERA_CSV = path.join(__dirname, 'Bordero', 'data', 'get-camera-name.csv');
const USERFORM_RECORDINGS_DIR = process.env.USERFORM_RECORDINGS_DIR || 'C:\\VSC_WEBCAM';
const LEGACY_RECORDINGS_DIR = 'C:\\vsc_webcam';
const ELECTRON_CONTROL_PORT = process.env.ELECTRON_CONTROL_PORT ? parseInt(process.env.ELECTRON_CONTROL_PORT, 10) : 5512;
const USERFORM_FFMPEG_CANDIDATES = [
    process.env.FFMPEG_PATH,
    'C:/FFMPEG/bin/ffmpeg.exe',
    'C:/ffmpeg/bin/ffmpeg.exe'
].filter(Boolean);
const BORDERO_GOOGLE_SYNC_ENABLED = String(process.env.BORDERO_GOOGLE_SYNC_ENABLED || 'true').toLowerCase() !== 'false';
const BORDERO_GOOGLE_SYNC_INTERVAL_MS = parseBorderoGoogleSyncIntervalMs(process.env);

// ===== STATO GLOBALE =====
let chromeProcess = null;
// Mappa dei viewer avviati: pid -> { file, startedAt }
let openedViewers = {};
const OPENED_VIEWERS_FILE = path.join(__dirname, 'pdf', 'config', 'opened-viewers.json');

// Stato VLC per monitor secondario (controllo remoto)
const VLC_RC_HOST = '127.0.0.1';
const VLC_RC_PORT = process.env.VLC_RC_PORT ? parseInt(process.env.VLC_RC_PORT, 10) : 4212;
const DISPLAY_WINDOW_TITLE_HINT = process.env.DISPLAY_WINDOW_TITLE_HINT || 'Monitor Secondario';
const ELECTRON_MONITOR_PREFERENCES_FILE = path.join(__dirname, 'electron', 'monitor-preferences.json');
let vlcProcess = null;
let vlcCurrentFile = '';
let vlcDiscoveryPromise = null;
let vlcLaunchSequence = 0;
let vlcPauseSequence = 0;
let vlcForegroundGuardTimer = null;
let vlcStopRequestedPids = new Set();
let vlcSettledPids = new Set();
let vlcCompletionEventSeq = 0;
let vlcLastCompletionEvent = {
    eventId: 0,
    filePath: '',
    fileName: '',
    completedAt: 0
};

let borderoGoogleSyncTimer = null;
let borderoGoogleSyncPromise = null;
let borderoGoogleSyncSchedulerStarted = false;
let userformRecordingProcess = null;
let userformRecordingFilePath = '';
let userformRecordingPlan = null;
let userformLiveVlcProcess = null;
const borderoGoogleSyncState = {
    enabled: BORDERO_GOOGLE_SYNC_ENABLED,
    intervalMs: BORDERO_GOOGLE_SYNC_INTERVAL_MS,
    inProgress: false,
    lastTrigger: 'never',
    lastStartedAt: null,
    lastCompletedAt: null,
    lastSuccessAt: null,
    lastError: '',
    lastSummary: null
};

function ensureSiaeExportDir() {
    if (!fs.existsSync(SIAE_EXPORT_DIR)) {
        fs.mkdirSync(SIAE_EXPORT_DIR, { recursive: true });
    }
    return SIAE_EXPORT_DIR;
}

function getSiaeExportPath(fileName = '') {
    const safeName = path.basename(fileName || '');
    return path.join(SIAE_EXPORT_DIR, safeName);
}

function sanitizeSiaeEventName(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return 'evento';

    const normalized = raw
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

    return normalized || 'evento';
}

async function runBorderoGoogleSync(trigger = 'manual') {
    if (!BORDERO_GOOGLE_SYNC_ENABLED) {
        return {
            success: false,
            skipped: true,
            reason: 'BORDERO_GOOGLE_SYNC_ENABLED=false'
        };
    }

    if (borderoGoogleSyncPromise) {
        return borderoGoogleSyncPromise;
    }

    borderoGoogleSyncState.inProgress = true;
    borderoGoogleSyncState.lastTrigger = trigger;
    borderoGoogleSyncState.lastStartedAt = new Date().toISOString();

    borderoGoogleSyncPromise = syncGoogleSheetsData({ exitOnFailure: false, onlySheets: ['Accoda 8+12'] })
        .then((summary) => {
            const doneAt = new Date().toISOString();
            borderoGoogleSyncState.lastCompletedAt = doneAt;
            borderoGoogleSyncState.lastSummary = summary;
            borderoGoogleSyncState.lastError = '';
            if (summary?.success) {
                borderoGoogleSyncState.lastSuccessAt = doneAt;
            }
            return summary;
        })
        .catch((error) => {
            const doneAt = new Date().toISOString();
            borderoGoogleSyncState.lastCompletedAt = doneAt;
            borderoGoogleSyncState.lastError = error?.message || String(error);
            return {
                success: false,
                error: borderoGoogleSyncState.lastError,
                syncedAt: doneAt
            };
        })
        .finally(() => {
            borderoGoogleSyncState.inProgress = false;
            borderoGoogleSyncPromise = null;
        });

    return borderoGoogleSyncPromise;
}

function startBorderoGoogleSyncScheduler() {
    if (borderoGoogleSyncSchedulerStarted) {
        return;
    }

    if (!BORDERO_GOOGLE_SYNC_ENABLED) {
        console.log('ℹ️ Google sync Bordero disabilitato (BORDERO_GOOGLE_SYNC_ENABLED=false)');
        return;
    }

    borderoGoogleSyncSchedulerStarted = true;

    runBorderoGoogleSync('startup').then((summary) => {
        if (summary?.success) {
            console.log(`✅ Bordero Google sync startup completato (${summary.successCount}/${summary.totalSheets})`);
        } else {
            console.warn('⚠️ Bordero Google sync startup incompleto o fallito');
        }
    }).catch((error) => {
        console.warn('⚠️ Bordero Google sync startup error:', error?.message || error);
    });

    if (!shouldScheduleBorderoGoogleSync(process.env)) {
        console.log('ℹ️ Bordero Google sync scheduler disabilitato (intervallo non impostato o <= 0)');
        return;
    }

    borderoGoogleSyncTimer = setInterval(() => {
        runBorderoGoogleSync('interval').catch((error) => {
            console.warn('⚠️ Bordero Google sync interval error:', error?.message || error);
        });
    }, BORDERO_GOOGLE_SYNC_INTERVAL_MS);

    console.log(`⏱️ Bordero Google sync scheduler attivo ogni ${BORDERO_GOOGLE_SYNC_INTERVAL_MS} ms`);
}

function trackVlcStopRequestForCurrentProcess() {
    if (vlcProcess?.pid) {
        vlcStopRequestedPids.add(vlcProcess.pid);
    }
}

function recordVlcCompletion(filePath) {
    const normalized = String(filePath || '').trim();
    if (!normalized) return;

    vlcCompletionEventSeq += 1;
    vlcLastCompletionEvent = {
        eventId: vlcCompletionEventSeq,
        filePath: normalized,
        fileName: path.basename(normalized),
        completedAt: Date.now()
    };
}

function readElectronMonitorPreferences() {
    try {
        if (!fs.existsSync(ELECTRON_MONITOR_PREFERENCES_FILE)) {
            return {
                swapPrimarySecondary: false,
                primaryMonitorChoice: null,
                selectionConfirmed: false
            };
        }
        const raw = fs.readFileSync(ELECTRON_MONITOR_PREFERENCES_FILE, 'utf8').replace(/^\uFEFF/, '').trim();
        if (!raw) {
            return {
                swapPrimarySecondary: false,
                primaryMonitorChoice: null,
                selectionConfirmed: false
            };
        }
        const parsed = JSON.parse(raw);

        const explicitChoice = Number(parsed?.primaryMonitorChoice);
        let primaryMonitorChoice = null;
        if (explicitChoice === 1 || explicitChoice === 2) {
            primaryMonitorChoice = explicitChoice;
        }

        const swapPrimarySecondary = primaryMonitorChoice === null
            ? Boolean(parsed && parsed.swapPrimarySecondary)
            : primaryMonitorChoice === 2;

        return {
            swapPrimarySecondary,
            primaryMonitorChoice,
            selectionConfirmed: Boolean(parsed && parsed.selectionConfirmed)
        };
    } catch (error) {
        console.warn('⚠️ Lettura preferenze monitor Electron fallita, uso default:', error?.message || error);
        return {
            swapPrimarySecondary: false,
            primaryMonitorChoice: null,
            selectionConfirmed: false
        };
    }
}

function writeElectronMonitorPreferences(preferences = {}) {
    const explicitChoice = Number(preferences?.primaryMonitorChoice);
    const primaryMonitorChoice = (explicitChoice === 1 || explicitChoice === 2)
        ? explicitChoice
        : (Boolean(preferences?.swapPrimarySecondary) ? 2 : 1);

    const payload = {
        primaryMonitorChoice,
        swapPrimarySecondary: primaryMonitorChoice === 2,
        selectionConfirmed: Object.prototype.hasOwnProperty.call(preferences, 'selectionConfirmed')
            ? Boolean(preferences.selectionConfirmed)
            : true,
        updatedAt: new Date().toISOString()
    };

    if (preferences?.source) {
        payload.source = String(preferences.source);
    }

    fs.mkdirSync(path.dirname(ELECTRON_MONITOR_PREFERENCES_FILE), { recursive: true });
    fs.writeFileSync(ELECTRON_MONITOR_PREFERENCES_FILE, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
}

function reconcileVlcProcessState() {
    if (!vlcProcess?.pid) return;

    const trackedPid = vlcProcess.pid;
    const trackedFile = vlcCurrentFile;
    const alive = isVlcAlive();
    if (alive) return;

    const wasStopRequested = vlcStopRequestedPids.has(trackedPid);
    vlcSettledPids.add(trackedPid);
    if (wasStopRequested) {
        vlcStopRequestedPids.delete(trackedPid);
    } else if (trackedFile) {
        recordVlcCompletion(trackedFile);
    }

    resetVlcState();
}

function isVlcAlive() {
    if (!vlcProcess || !vlcProcess.pid) return false;
    try {
        process.kill(vlcProcess.pid, 0);
        return true;
    } catch (_) {
        return false;
    }
}

app.get('/api/electron/monitor-preferences', (req, res) => {
    const preferences = readElectronMonitorPreferences();
    return res.json({
        ok: true,
        swapPrimarySecondary: Boolean(preferences.swapPrimarySecondary),
        primaryMonitorChoice: preferences.primaryMonitorChoice,
        selectionConfirmed: Boolean(preferences.selectionConfirmed)
    });
});

app.post('/api/electron/swap-monitors', (req, res) => {
    const current = readElectronMonitorPreferences();
    const hasExplicitValue = Object.prototype.hasOwnProperty.call(req.body || {}, 'swapPrimarySecondary');

    const swapPrimarySecondary = hasExplicitValue
        ? Boolean(req.body.swapPrimarySecondary)
        : !Boolean(current.swapPrimarySecondary);

    const saved = writeElectronMonitorPreferences({
        primaryMonitorChoice: swapPrimarySecondary ? 2 : 1,
        selectionConfirmed: true,
        source: 'api-swap-monitors'
    });
    console.log(`🖥️ Electron monitor swap impostato a: ${saved.swapPrimarySecondary ? 'ON' : 'OFF'}`);

    return res.json({
        ok: true,
        swapPrimarySecondary: saved.swapPrimarySecondary,
        primaryMonitorChoice: saved.primaryMonitorChoice,
        updatedAt: saved.updatedAt
    });
});

function clearVlcForegroundGuard() {
    if (vlcForegroundGuardTimer) {
        clearInterval(vlcForegroundGuardTimer);
        vlcForegroundGuardTimer = null;
    }
}

async function focusWindowByProcessId(processId) {
    const pid = Number(processId || 0);
    if (!pid) return false;

    const psCommand = [
        '$pidTarget = ' + pid,
        '$proc = Get-Process -Id $pidTarget -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1',
        'if (-not $proc) { exit 2 }',
        '$wshell = New-Object -ComObject WScript.Shell',
        '$ok = $wshell.AppActivate($proc.Id)',
        'if ($ok) { exit 0 }',
        'exit 3'
    ].join('; ');

    try {
        await execFileAsync('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy', 'Bypass',
            '-Command', psCommand
        ]);
        return true;
    } catch (_) {
        return false;
    }
}

async function focusWindowByTitleHints(titleHints = []) {
    const hints = titleHints
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .map((item) => item.replace(/'/g, "''"));

    if (hints.length === 0) return false;

    const whereClauses = hints.map((hint) => `($_.MainWindowTitle -like '*${hint}*')`).join(' -or ');
    const psCommand = [
        '$target = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and (' + whereClauses + ') } | Sort-Object StartTime -Descending | Select-Object -First 1',
        'if (-not $target) { exit 2 }',
        '$wshell = New-Object -ComObject WScript.Shell',
        '$ok = $wshell.AppActivate($target.Id)',
        'if ($ok) { exit 0 }',
        'exit 3'
    ].join('; ');

    try {
        await execFileAsync('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy', 'Bypass',
            '-Command', psCommand
        ]);
        return true;
    } catch (_) {
        return false;
    }
}

async function forceVlcForeground(reason = 'playback') {
    const tracked = await ensureVlcTracked().catch(() => null);
    const pid = Number(tracked?.pid || vlcProcess?.pid || 0);
    if (!pid) return false;

    const focusedByPid = await focusWindowByProcessId(pid);
    if (focusedByPid) {
        console.log(`🎬 VLC portato in primo piano (${reason})`);
        return true;
    }

    const focusedByTitle = await focusWindowByTitleHints(['VLC media player', 'VLC']);
    if (focusedByTitle) {
        console.log(`🎬 VLC portato in primo piano via titolo (${reason})`);
        return true;
    }

    return false;
}

async function restoreDisplayWindowForeground(reason = 'vlc-ended') {
    const focused = await focusWindowByTitleHints([
        DISPLAY_WINDOW_TITLE_HINT,
        'DISPLAY COREOGRAFIE RICHIESTE',
        'BORDERO\' - Monitor Secondario',
        'Bordero - Monitor Secondario',
        'Monitor Secondario'
    ]);

    if (focused) {
        console.log(`🖥️ Pagina HTML monitor ripristinata in primo piano (${reason})`);
    }

    return focused;
}

function startVlcForegroundGuard() {
    clearVlcForegroundGuard();

    let attempts = 0;
    vlcForegroundGuardTimer = setInterval(async () => {
        attempts += 1;

        if (!isVlcAlive() || attempts > 15) {
            clearVlcForegroundGuard();
            return;
        }

        try {
            await forceVlcForeground('guard');
        } catch (_) {
            // best effort: non blocca la riproduzione
        }
    }, 1000);
}

function resetVlcState() {
    vlcProcess = null;
    vlcCurrentFile = '';
    clearVlcForegroundGuard();
}

function resolveVideoPath(videoUrl) {
    const parsed = new URL(videoUrl, 'http://localhost');
    const relativePath = parsed.pathname.replace(/^\/videos\//i, '');
    const fileName = decodeURIComponent(relativePath);
    return path.join(VIDEOCLIP_DIR, fileName);
}

function extractVlcFileFromCommandLine(commandLine) {
    const text = String(commandLine || '').trim();
    if (!text) return '';

    const quotedPaths = [...text.matchAll(/"([A-Za-z]:\\[^\"]+)"/g)].map((match) => match[1]);
    for (let index = quotedPaths.length - 1; index >= 0; index -= 1) {
        const candidate = quotedPaths[index];
        if (/\.(mp4|mkv|mov|avi|webm|m4v)$/i.test(candidate)) {
            return candidate;
        }
    }

    return '';
}

function execFileAsync(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(command, args, { windowsHide: true, ...options }, (error, stdout, stderr) => {
            if (error) {
                error.stdout = stdout;
                error.stderr = stderr;
                reject(error);
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}

function getVlcExecutableCandidates() {
    const envValue = String(process.env.VLC_PATH || '').trim();
    const envCandidates = envValue
        ? envValue.split(/[;,]/).map((value) => value.trim()).filter(Boolean)
        : [];

    return [...new Set([
        ...envCandidates,
        'C:/Program Files/VideoLAN/VLC/vlc.exe',
        'C:/Program Files (x86)/VideoLAN/VLC/vlc.exe'
    ])];
}

function resolveVlcExecutable() {
    const candidates = getVlcExecutableCandidates();

    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return candidates[0] || '';
}

function ensureUserformRecordingDir() {
    if (!fs.existsSync(USERFORM_RECORDINGS_DIR)) {
        fs.mkdirSync(USERFORM_RECORDINGS_DIR, { recursive: true });
    }
    return USERFORM_RECORDINGS_DIR;
}

function resolveFfmpegExecutable() {
    for (const candidate of USERFORM_FFMPEG_CANDIDATES) {
        const normalized = String(candidate || '').trim();
        if (normalized && fs.existsSync(normalized)) {
            return normalized;
        }
    }
    return '';
}

function sanitizeCsvValue(value) {
    return String(value ?? '').replace(/^\uFEFF/, '').trim();
}

async function callElectronControl(pathname = '/', payload) {
    const response = await fetch(`http://127.0.0.1:${ELECTRON_CONTROL_PORT}${pathname}`, {
        method: payload === undefined ? 'GET' : 'POST',
        headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: payload === undefined ? undefined : JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success === false || data?.ok === false) {
        throw new Error(data?.error || `Electron control bridge HTTP ${response.status}`);
    }
    return data;
}

const USERFORM_CAMERA_CSV_HEADER = [
    'value',
    'Codifica',
    'dshow-size',
    'dshow-fps',
    'ELENCO WEBCAM',
    'profile-id',
    'is-default',
    'is-enabled',
    'last-used-at',
    'last-mode',
    'last-status',
    'usage-count',
    'last-size',
    'last-fps',
    'last-codec',
    'notes'
];

function csvEscapeValue(value) {
    const text = String(value ?? '');
    if (!/[",\r\n]/.test(text)) {
        return text;
    }
    return `"${text.replace(/"/g, '""')}"`;
}

function readCameraField(row = {}, aliases = []) {
    for (const alias of aliases) {
        const value = sanitizeCsvValue(row?.[alias]);
        if (value) {
            return value;
        }
    }
    return '';
}

function parseCsvBoolean(value, fallback = true) {
    const normalized = sanitizeCsvValue(value).toLowerCase();
    if (!normalized) {
        return fallback;
    }
    if (['1', 'true', 'yes', 'y', 'si'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'n'].includes(normalized)) {
        return false;
    }
    return fallback;
}

function parseCsvInteger(value, fallback = 0) {
    const n = Number.parseInt(sanitizeCsvValue(value), 10);
    return Number.isFinite(n) ? n : fallback;
}

function ensureProfileId(name = '') {
    const normalized = sanitizeCsvValue(name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || `camera-${Date.now()}`;
}

function mapCsvRowToCameraProfile(row = {}) {
    const name = readCameraField(row, ['value', 'Value', 'name']);
    if (!name) {
        return null;
    }

    const codec = readCameraField(row, ['Codifica', 'codifica', 'codec', 'last-codec']);
    const size = readCameraField(row, ['dshow-size', 'dshowSize', 'size', 'last-size']);
    const fps = readCameraField(row, ['dshow-fps', 'dshowFps', 'fps', 'last-fps']);

    return {
        name,
        codec,
        size,
        fps,
        label: readCameraField(row, ['ELENCO WEBCAM', 'label', 'descrizione']),
        profileId: readCameraField(row, ['profile-id', 'profileId']) || ensureProfileId(name),
        isDefault: parseCsvBoolean(readCameraField(row, ['is-default', 'isDefault']), false),
        isEnabled: parseCsvBoolean(readCameraField(row, ['is-enabled', 'isEnabled']), true),
        lastUsedAt: readCameraField(row, ['last-used-at', 'lastUsedAt']),
        lastMode: readCameraField(row, ['last-mode', 'lastMode']),
        lastStatus: readCameraField(row, ['last-status', 'lastStatus']),
        usageCount: parseCsvInteger(readCameraField(row, ['usage-count', 'usageCount']), 0),
        lastSize: readCameraField(row, ['last-size', 'lastSize']) || size,
        lastFps: readCameraField(row, ['last-fps', 'lastFps']) || fps,
        lastCodec: readCameraField(row, ['last-codec', 'lastCodec']) || codec,
        notes: readCameraField(row, ['notes', 'note'])
    };
}

function parseDshowVideoDeviceNames(outputText = '') {
    const source = String(outputText || '');
    const matches = [...source.matchAll(/"([^"]+)"\s+\(video\)/gi)];
    const names = matches
        .map((match) => sanitizeCsvValue(match[1]))
        .filter(Boolean);

    return [...new Set(names)];
}

function choosePreferredSystemWebcam(deviceNames = []) {
    if (!Array.isArray(deviceNames) || deviceNames.length === 0) {
        return '';
    }

    const virtualPattern = /(virtual|splitter|obs|xsplit|manycam|ndi)/i;
    const physical = deviceNames.find((name) => !virtualPattern.test(name));
    return physical || deviceNames[0] || '';
}

async function detectSystemWebcamFromFfmpeg() {
    const ffmpegPath = resolveFfmpegExecutable();
    if (!ffmpegPath) {
        return {
            detectedName: '',
            candidates: [],
            ffmpegPath: '',
            error: 'FFmpeg non trovato'
        };
    }

    try {
        const { stderr, stdout } = await execFileAsync(ffmpegPath, [
            '-hide_banner',
            '-list_devices', 'true',
            '-f', 'dshow',
            '-i', 'dummy'
        ], { maxBuffer: 1024 * 1024 });

        const deviceNames = parseDshowVideoDeviceNames(`${stderr || ''}\n${stdout || ''}`);
        return {
            detectedName: choosePreferredSystemWebcam(deviceNames),
            candidates: deviceNames,
            ffmpegPath,
            error: ''
        };
    } catch (error) {
        const stderr = String(error?.stderr || '');
        const stdout = String(error?.stdout || '');
        const deviceNames = parseDshowVideoDeviceNames(`${stderr}\n${stdout}`);
        return {
            detectedName: choosePreferredSystemWebcam(deviceNames),
            candidates: deviceNames,
            ffmpegPath,
            error: error?.message || String(error)
        };
    }
}

function writeUserformCameraProfilesCsv(rows = []) {
    const lines = [USERFORM_CAMERA_CSV_HEADER.join(',')];

    for (const row of rows) {
        const profile = mapCsvRowToCameraProfile(row);
        if (!profile) {
            continue;
        }

        const values = [
            csvEscapeValue(profile.name),
            csvEscapeValue(profile.codec),
            csvEscapeValue(profile.size),
            csvEscapeValue(profile.fps),
            csvEscapeValue(profile.label),
            csvEscapeValue(profile.profileId),
            csvEscapeValue(profile.isDefault ? '1' : '0'),
            csvEscapeValue(profile.isEnabled ? '1' : '0'),
            csvEscapeValue(profile.lastUsedAt),
            csvEscapeValue(profile.lastMode),
            csvEscapeValue(profile.lastStatus),
            csvEscapeValue(String(Math.max(0, Number(profile.usageCount) || 0))),
            csvEscapeValue(profile.lastSize),
            csvEscapeValue(profile.lastFps),
            csvEscapeValue(profile.lastCodec),
            csvEscapeValue(profile.notes)
        ];
        lines.push(values.join(','));
    }

    fs.writeFileSync(USERFORM_CAMERA_CSV, `${lines.join('\r\n')}\r\n`, 'utf8');
}

async function ensureSystemWebcamInUserformCsv() {
    const detection = await detectSystemWebcamFromFfmpeg();
    const detectedName = sanitizeCsvValue(detection.detectedName);

    if (!detectedName) {
        return {
            added: false,
            detectedName: '',
            candidates: detection.candidates || [],
            error: detection.error || ''
        };
    }

    const raw = fs.existsSync(USERFORM_CAMERA_CSV)
        ? fs.readFileSync(USERFORM_CAMERA_CSV, 'utf8').replace(/^\uFEFF/, '')
        : `${USERFORM_CAMERA_CSV_HEADER.join(',')}\n`;

    const rows = parseCsv(raw, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true
    });

    const existingProfiles = rows
        .map((row) => mapCsvRowToCameraProfile(row))
        .filter(Boolean);
    const alreadyPresent = existingProfiles.some((row) => row.name.toLowerCase() === detectedName.toLowerCase());
    const hasDefault = existingProfiles.some((row) => row.isDefault);

    if (!alreadyPresent) {
        rows.push({
            value: detectedName,
            Codifica: 'yuyv422',
            'dshow-size': '1280x720',
            'dshow-fps': '30',
            'ELENCO WEBCAM': 'Sistema - Webcam auto-rilevata',
            'profile-id': ensureProfileId(detectedName),
            'is-default': hasDefault ? '0' : '1',
            'is-enabled': '1',
            'last-status': 'detected',
            'usage-count': '0',
            'last-size': '1280x720',
            'last-fps': '30',
            'last-codec': 'yuyv422',
            notes: 'Aggiunta automaticamente da rilevamento sistema'
        });
        writeUserformCameraProfilesCsv(rows);
    }

    return {
        added: !alreadyPresent,
        detectedName,
        candidates: detection.candidates || [],
        error: detection.error || ''
    };
}

function loadUserformCameraProfiles(includeDisabled = false) {
    if (!fs.existsSync(USERFORM_CAMERA_CSV)) {
        return [];
    }

    const raw = fs.readFileSync(USERFORM_CAMERA_CSV, 'utf8').replace(/^\uFEFF/, '');
    const rows = parseCsv(raw, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true
    });

    return rows
        .map((row) => mapCsvRowToCameraProfile(row))
        .filter((row) => {
            if (!row?.name) {
                return false;
            }
            if (includeDisabled) {
                return true;
            }
            return row.isEnabled !== false;
        });
}

function saveUserformCameraProfiles(profiles = []) {
    writeUserformCameraProfilesCsv(profiles);
}

function toInputBoolean(value, fallback = false) {
    if (typeof value === 'boolean') {
        return value;
    }
    return parseCsvBoolean(value, fallback);
}

function upsertUserformCameraProfile(cameraName = '', payload = {}) {
    const normalizedName = sanitizeCsvValue(cameraName);
    if (!normalizedName) {
        return null;
    }

    const profiles = loadUserformCameraProfiles(true);
    const index = profiles.findIndex((item) => item.name.toLowerCase() === normalizedName.toLowerCase());
    const nowIso = new Date().toISOString();

    const base = index >= 0
        ? profiles[index]
        : {
            name: normalizedName,
            codec: '',
            size: '',
            fps: '',
            label: '',
            profileId: ensureProfileId(normalizedName),
            isDefault: false,
            isEnabled: true,
            lastUsedAt: '',
            lastMode: '',
            lastStatus: '',
            usageCount: 0,
            lastSize: '',
            lastFps: '',
            lastCodec: '',
            notes: ''
        };

    const next = {
        ...base,
        name: normalizedName,
        codec: sanitizeCsvValue(payload.codec) || base.codec,
        size: sanitizeCsvValue(payload.size) || base.size,
        fps: sanitizeCsvValue(payload.fps) || base.fps,
        label: sanitizeCsvValue(payload.label) || base.label,
        profileId: sanitizeCsvValue(payload.profileId) || base.profileId || ensureProfileId(normalizedName),
        isDefault: Object.prototype.hasOwnProperty.call(payload, 'isDefault')
            ? toInputBoolean(payload.isDefault, false)
            : base.isDefault,
        isEnabled: Object.prototype.hasOwnProperty.call(payload, 'isEnabled')
            ? toInputBoolean(payload.isEnabled, true)
            : base.isEnabled,
        lastUsedAt: sanitizeCsvValue(payload.lastUsedAt) || (payload.touchNow ? nowIso : base.lastUsedAt),
        lastMode: sanitizeCsvValue(payload.lastMode) || base.lastMode,
        lastStatus: sanitizeCsvValue(payload.lastStatus) || base.lastStatus,
        usageCount: Object.prototype.hasOwnProperty.call(payload, 'usageCount')
            ? Math.max(0, Number.parseInt(sanitizeCsvValue(payload.usageCount), 10) || 0)
            : base.usageCount,
        lastSize: sanitizeCsvValue(payload.lastSize) || sanitizeCsvValue(payload.size) || base.lastSize || base.size,
        lastFps: sanitizeCsvValue(payload.lastFps) || sanitizeCsvValue(payload.fps) || base.lastFps || base.fps,
        lastCodec: sanitizeCsvValue(payload.lastCodec) || sanitizeCsvValue(payload.codec) || base.lastCodec || base.codec,
        notes: Object.prototype.hasOwnProperty.call(payload, 'notes')
            ? sanitizeCsvValue(payload.notes)
            : base.notes
    };

    if (index >= 0) {
        profiles[index] = next;
    } else {
        profiles.push(next);
    }

    if (next.isDefault) {
        for (const item of profiles) {
            if (item.name.toLowerCase() !== normalizedName.toLowerCase()) {
                item.isDefault = false;
            }
        }
    }

    saveUserformCameraProfiles(profiles);
    return next;
}

function updateUserformCameraProfileUsage(cameraName = '', payload = {}) {
    const normalizedName = sanitizeCsvValue(cameraName);
    if (!normalizedName) {
        return null;
    }

    const profiles = loadUserformCameraProfiles(true);
    const nowIso = new Date().toISOString();
    const index = profiles.findIndex((item) => item.name.toLowerCase() === normalizedName.toLowerCase());

    const base = index >= 0
        ? profiles[index]
        : {
            name: normalizedName,
            codec: sanitizeCsvValue(payload.codec) || 'yuyv422',
            size: sanitizeCsvValue(payload.size) || '640x480',
            fps: sanitizeCsvValue(payload.fps) || '30',
            label: 'Profilo creato automaticamente',
            profileId: ensureProfileId(normalizedName),
            isDefault: false,
            isEnabled: true,
            lastUsedAt: '',
            lastMode: '',
            lastStatus: '',
            usageCount: 0,
            lastSize: '',
            lastFps: '',
            lastCodec: '',
            notes: 'Creato da runtime durante uso camera'
        };

    const codec = sanitizeCsvValue(payload.codec) || base.codec;
    const size = sanitizeCsvValue(payload.size) || base.size;
    const fps = sanitizeCsvValue(payload.fps) || base.fps;
    const next = {
        ...base,
        codec,
        size,
        fps,
        lastCodec: codec || base.lastCodec,
        lastSize: size || base.lastSize,
        lastFps: fps || base.lastFps,
        lastMode: sanitizeCsvValue(payload.mode) || base.lastMode,
        lastStatus: sanitizeCsvValue(payload.status) || base.lastStatus,
        lastUsedAt: nowIso,
        usageCount: Math.max(0, Number(base.usageCount) || 0) + (payload.incrementUsage ? 1 : 0)
    };

    if (index >= 0) {
        profiles[index] = next;
    } else {
        profiles.push(next);
    }

    saveUserformCameraProfiles(profiles);
    return next;
}

function listUserformRecordingFiles(extensions = ['.mkv']) {
    const folders = [USERFORM_RECORDINGS_DIR]
        .map((folder) => path.resolve(folder))
        .filter((folder, index, all) => folder && all.indexOf(folder) === index && fs.existsSync(folder));

    const allowed = new Set(extensions.map((ext) => String(ext || '').toLowerCase()));
    const files = [];

    for (const folder of folders) {
        const entries = fs.readdirSync(folder, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile()) continue;
            const ext = path.extname(entry.name).toLowerCase();
            if (!allowed.has(ext)) continue;

            const fullPath = path.join(folder, entry.name);
            const stats = fs.statSync(fullPath);
            files.push({
                name: entry.name,
                path: fullPath,
                folder,
                sizeBytes: stats.size,
                mtimeMs: stats.mtimeMs
            });
        }
    }

    files.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return files;
}

function getUserformRecordingState() {
    const alive = Boolean(userformRecordingProcess?.pid);
    return {
        recording: alive,
        pid: alive ? userformRecordingProcess.pid : null,
        filePath: userformRecordingFilePath || '',
        recordingMode: userformRecordingPlan?.recordingMode || '',
        targetFilePath: userformRecordingPlan?.targetFilePath || '',
        sourceFilePath: userformRecordingPlan?.sourceFilePath || ''
    };
}

function waitForChildExit(child, timeoutMs = 3000) {
    return new Promise((resolve) => {
        if (!child || child.exitCode !== null) {
            resolve(true);
            return;
        }

        let done = false;
        const timer = setTimeout(() => {
            if (done) return;
            done = true;
            child.removeListener('exit', onExit);
            resolve(false);
        }, timeoutMs);

        const onExit = () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve(true);
        };

        child.once('exit', onExit);
    });
}

async function stopUserformRecordingIfRunning() {
    const recordedFilePath = userformRecordingFilePath || '';
    const currentPlan = userformRecordingPlan;

    if (!userformRecordingProcess?.pid) {
        userformRecordingProcess = null;
        userformRecordingFilePath = '';
        userformRecordingPlan = null;
        return { stopped: false, filePath: recordedFilePath };
    }

    const pid = userformRecordingProcess.pid;
    let aliveBeforeStop = true;
    try {
        process.kill(pid, 0);
    } catch (_) {
        aliveBeforeStop = false;
    }

    if (!aliveBeforeStop) {
        userformRecordingProcess = null;
        userformRecordingFilePath = '';
        userformRecordingPlan = null;
        return { stopped: true, pid, filePath: recordedFilePath };
    }

    let gracefulStopped = false;
    if (userformRecordingProcess?.stdin && !userformRecordingProcess.stdin.destroyed) {
        try {
            userformRecordingProcess.stdin.write('q\n');
            gracefulStopped = await waitForChildExit(userformRecordingProcess, 3000);
        } catch (_) {
            gracefulStopped = false;
        }
    }

    if (gracefulStopped) {
        userformRecordingProcess = null;
        userformRecordingFilePath = '';
        let conversion = null;

        if (currentPlan?.convertToMp4OnStop && currentPlan.sourceFilePath && currentPlan.targetFilePath) {
            try {
                conversion = await convertUserformRecordingToMp4(currentPlan);
            } catch (error) {
                conversion = {
                    ok: false,
                    error: error?.message || String(error),
                    sourceFilePath: currentPlan.sourceFilePath,
                    targetFilePath: currentPlan.targetFilePath
                };
            }
        }

        userformRecordingPlan = null;
        return {
            stopped: true,
            pid,
            filePath: conversion?.ok ? conversion.targetFilePath : recordedFilePath,
            sourceFilePath: currentPlan?.sourceFilePath || '',
            targetFilePath: currentPlan?.targetFilePath || '',
            recordingMode: currentPlan?.recordingMode || '',
            conversion,
            graceful: true
        };
    }

    try {
        await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F']);
    } catch (error) {
        const stderr = String(error?.stderr || '').toLowerCase();
        const stdout = String(error?.stdout || '').toLowerCase();
        const combined = `${stdout} ${stderr}`;
        if (!combined.includes('not found') && !combined.includes('nessun processo') && !combined.includes('no running instance')) {
            throw error;
        }
    }

    userformRecordingProcess = null;
    userformRecordingFilePath = '';
    userformRecordingPlan = null;
    return {
        stopped: true,
        pid,
        filePath: recordedFilePath,
        sourceFilePath: currentPlan?.sourceFilePath || '',
        targetFilePath: currentPlan?.targetFilePath || '',
        recordingMode: currentPlan?.recordingMode || '',
        graceful: false
    };
}

function buildCameraCaptureArgs(profile = {}, outputFilePath = '') {
    const cameraName = sanitizeCsvValue(profile.name);
    const fps = sanitizeCsvValue(profile.fps);
    const outputExt = path.extname(String(outputFilePath || '')).toLowerCase();

    const args = ['-y', '-f', 'dshow', '-rtbufsize', '64M'];

    // Avoid forcing size/pixel format here: many webcams reject strict dshow options.
    if (/^\d{1,3}$/.test(fps)) {
        args.push('-framerate', fps);
    }

    args.push('-i', `video=${cameraName}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p');
    if (outputExt === '.mp4') {
        args.push('-movflags', '+faststart');
    }
    args.push(outputFilePath);
    return args;
}

function buildConvertToMp4Args(inputFilePath = '', outputFilePath = '') {
    return [
        '-y',
        '-i', inputFilePath,
        '-map', '0:v:0',
        '-map', '0:a?',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '18',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputFilePath
    ];
}

function resolveUserformRecordingMode(value = '') {
    const normalized = sanitizeCsvValue(value).toLowerCase();
    if (['native', 'native-then-mp4', 'native_then_mp4', 'mkv-then-mp4', 'mkv_then_mp4'].includes(normalized)) {
        return 'native-then-mp4';
    }
    return 'direct-mp4';
}

function buildUserformRecordingPlan({ recDir = '', timestamp = '', recordingMode = 'direct-mp4' } = {}) {
    const effectiveMode = resolveUserformRecordingMode(recordingMode);
    if (effectiveMode === 'native-then-mp4') {
        const sourceFileName = `${timestamp}.mkv`;
        const targetFileName = `${timestamp}.mp4`;
        return {
            recordingMode: effectiveMode,
            sourceFileName,
            sourceFilePath: path.join(recDir, sourceFileName),
            targetFileName,
            targetFilePath: path.join(recDir, targetFileName),
            outputFilePath: path.join(recDir, sourceFileName),
            convertToMp4OnStop: true
        };
    }

    const targetFileName = `${timestamp}.mp4`;
    return {
        recordingMode: 'direct-mp4',
        sourceFileName: targetFileName,
        sourceFilePath: path.join(recDir, targetFileName),
        targetFileName,
        targetFilePath: path.join(recDir, targetFileName),
        outputFilePath: path.join(recDir, targetFileName),
        convertToMp4OnStop: false
    };
}

async function convertUserformRecordingToMp4(plan = {}) {
    const ffmpegPath = resolveFfmpegExecutable();
    if (!ffmpegPath) {
        throw new Error('FFmpeg non trovato per conversione MP4');
    }

    const source = path.resolve(String(plan.sourceFilePath || ''));
    const target = path.resolve(String(plan.targetFilePath || ''));
    if (!source || !target) {
        throw new Error('Percorsi conversione non validi');
    }
    if (!fs.existsSync(source)) {
        throw new Error(`File sorgente non trovato: ${source}`);
    }

    const convertArgs = buildConvertToMp4Args(source, target);
    await execFileAsync(ffmpegPath, convertArgs, { maxBuffer: 10 * 1024 * 1024 });

    if (!fs.existsSync(target)) {
        throw new Error('Conversione completata ma file MP4 non trovato');
    }

    return {
        ok: true,
        ffmpegPath,
        ffmpegArgs: convertArgs,
        sourceFilePath: source,
        targetFilePath: target
    };
}

function spawnDetachedProcess(executablePath, args = []) {
    const child = spawn(executablePath, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    return child;
}

function getUserformLiveVlcState() {
    const pid = Number(userformLiveVlcProcess?.pid || 0);
    if (!pid) {
        return { alive: false, pid: null };
    }

    try {
        process.kill(pid, 0);
        return { alive: true, pid };
    } catch (_) {
        userformLiveVlcProcess = null;
        return { alive: false, pid: null };
    }
}

async function stopUserformLiveVlc() {
    const state = getUserformLiveVlcState();
    if (!state.alive || !state.pid) {
        userformLiveVlcProcess = null;
        return { stopped: false };
    }

    try {
        await execFileAsync('taskkill', ['/PID', String(state.pid), '/T', '/F']);
    } catch (error) {
        const stderr = String(error?.stderr || '').toLowerCase();
        if (!stderr.includes('not found') && !stderr.includes('nessun processo')) {
            throw error;
        }
    }

    userformLiveVlcProcess = null;
    return { stopped: true, pid: state.pid };
}

function attachVlcChildProcess(child, launchedFile) {
    const launchedPid = child.pid;

    child.on('exit', () => {
        if (vlcSettledPids.has(launchedPid)) {
            vlcSettledPids.delete(launchedPid);
            return;
        }

        const wasStopRequested = vlcStopRequestedPids.has(launchedPid);
        if (wasStopRequested) {
            vlcStopRequestedPids.delete(launchedPid);
        } else if (launchedFile) {
            recordVlcCompletion(launchedFile);
            restoreDisplayWindowForeground('vlc-completed').catch(() => null);
        }

        if (vlcProcess?.pid === launchedPid) {
            resetVlcState();
        }
    });
}

async function discoverManagedVlcProcess() {
    if (vlcDiscoveryPromise) {
        return vlcDiscoveryPromise;
    }

    const psCommand = [
        '$proc = Get-CimInstance Win32_Process | Where-Object {',
        "  $_.Name -match '^vlc(\\.exe)?$'",
        '} | Select-Object -First 1 ProcessId, CommandLine',
        'if ($proc) { $proc | ConvertTo-Json -Compress }'
    ].join(' ');

    vlcDiscoveryPromise = execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-Command', psCommand
    ]).then(({ stdout }) => {
        const raw = String(stdout || '').trim();
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw);
        const processId = Number(parsed?.ProcessId || 0);
        if (!processId) {
            return null;
        }

        const commandLine = String(parsed?.CommandLine || '');
        vlcProcess = { pid: processId };
        const discoveredFile = extractVlcFileFromCommandLine(commandLine);
        if (discoveredFile) {
            vlcCurrentFile = discoveredFile;
        }

        return { pid: processId, commandLine, filePath: discoveredFile };
    }).catch(() => null).finally(() => {
        vlcDiscoveryPromise = null;
    });

    return vlcDiscoveryPromise;
}

async function ensureVlcTracked() {
    if (isVlcAlive()) {
        return { pid: vlcProcess.pid, filePath: vlcCurrentFile, source: 'memory' };
    }

    return discoverManagedVlcProcess();
}

function openVlcRcSocket(timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: VLC_RC_HOST, port: VLC_RC_PORT }, () => {
            resolve(socket);
        });

        socket.setTimeout(timeoutMs);
        socket.once('error', (err) => {
            try { socket.destroy(); } catch (_) {}
            reject(err);
        });
        socket.once('timeout', () => {
            try { socket.destroy(); } catch (_) {}
            reject(new Error('VLC RC socket timeout'));
        });
    });
}

async function sendVlcCommand(command, { timeoutMs = 1500, idleMs = 200 } = {}) {
    const socket = await openVlcRcSocket();

    return new Promise((resolve, reject) => {
        let output = '';
        let settled = false;
        let idleTimer = null;

        const cleanup = () => {
            if (idleTimer) {
                clearTimeout(idleTimer);
                idleTimer = null;
            }
            socket.removeAllListeners('data');
            socket.removeAllListeners('error');
            socket.removeAllListeners('timeout');
        };

        const finish = () => {
            if (settled) return;
            settled = true;
            cleanup();
            try { socket.end(); } catch (_) {}
            resolve(output);
        };

        const fail = (error) => {
            if (settled) return;
            settled = true;
            cleanup();
            try { socket.destroy(); } catch (_) {}
            reject(error);
        };

        const scheduleFinish = () => {
            if (idleTimer) {
                clearTimeout(idleTimer);
            }
            idleTimer = setTimeout(finish, idleMs);
        };

        socket.setTimeout(timeoutMs);
        socket.on('data', (chunk) => {
            output += chunk.toString('utf8');
            scheduleFinish();
        });
        socket.once('error', fail);
        socket.once('timeout', () => fail(new Error('VLC RC command timeout')));

        socket.write(`${command}\n`, (err) => {
            if (err) {
                fail(err);
                return;
            }
            scheduleFinish();
        });
    });
}

function isVlcPausedStatus(statusText) {
    const text = String(statusText || '');
    return /Type 'pause' to continue\.|pause state:\s*\d+\)\s*:\s*Pause/i.test(text);
}

async function pauseVlcViaWindow() {
    await ensureVlcTracked().catch(() => null);

    const psCommand = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$wshell = New-Object -ComObject WScript.Shell',
        vlcProcess?.pid
            ? `$activated = $wshell.AppActivate(${vlcProcess.pid})`
            : "$activated = $wshell.AppActivate('VLC media player')",
        'if (-not $activated) { exit 1 }',
        '[System.Windows.Forms.SendKeys]::SendWait(" ")'
    ].join('; ');

    await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-Command', psCommand
    ]);

    return { transport: 'window' };
}

async function pauseVlcPlayback() {
    const pauseToken = ++vlcPauseSequence;

    const tracked = await ensureVlcTracked();
    if (!tracked) {
        throw new Error('No running VLC instance');
    }

    try {
        const statusBefore = await sendVlcCommand('status');
        if (pauseToken !== vlcPauseSequence) {
            const error = new Error('Superseded by newer VLC pause request');
            error.code = 'VLC_PAUSE_SUPERSEDED';
            throw error;
        }

        if (isVlcPausedStatus(statusBefore)) {
            return { transport: 'rc', mode: 'already-paused' };
        }

        await sendVlcCommand('pause');

        if (pauseToken !== vlcPauseSequence) {
            const error = new Error('Superseded by newer VLC pause request');
            error.code = 'VLC_PAUSE_SUPERSEDED';
            throw error;
        }

        const statusAfter = await sendVlcCommand('status').catch(() => '');
        if (statusAfter && !isVlcPausedStatus(statusAfter)) {
            throw new Error('VLC did not enter pause state');
        }

        await forceVlcForeground('pause-toggle');

        return { transport: 'rc', mode: 'paused' };
    } catch (rcError) {
        if (rcError?.code === 'VLC_PAUSE_SUPERSEDED') {
            throw rcError;
        }
        const direct = await pauseVlcViaWindow();
        return { ...direct, fallbackFrom: rcError.message };
    }
}

async function forceKillVlc() {
    try {
        trackVlcStopRequestForCurrentProcess();
        if (vlcProcess?.pid) {
            await execFileAsync('taskkill', ['/PID', String(vlcProcess.pid), '/T', '/F']);
        } else {
            await execFileAsync('taskkill', ['/IM', 'vlc.exe', '/T', '/F']);
        }
    } catch (error) {
        const details = `${error?.message || ''}\n${error?.stdout || ''}\n${error?.stderr || ''}`;
        if (!/not found|non trovato|nessuna istanza|no running instance|cannot find/i.test(details)) {
            throw error;
        }
    } finally {
        resetVlcState();
    }

    return { transport: 'taskkill' };
}

async function killAllVlcProcesses() {
    try {
        trackVlcStopRequestForCurrentProcess();
        await execFileAsync('taskkill', ['/IM', 'vlc.exe', '/T', '/F']);
    } catch (error) {
        const details = `${error?.message || ''}\n${error?.stdout || ''}\n${error?.stderr || ''}`;
        if (!/not found|non trovato|nessuna istanza|no running instance|cannot find/i.test(details)) {
            throw error;
        }
    } finally {
        resetVlcState();
    }

    return { transport: 'taskkill-all' };
}

async function ensureExclusiveVlcPlayback() {
    try {
        await stopVlcPlayback();
    } catch (_) {
        // Fallback globale subito sotto.
    }

    await killAllVlcProcesses();
}

async function stopVlcPlayback() {
    let lastError = null;
    trackVlcStopRequestForCurrentProcess();

    try {
        await sendVlcCommand('stop');
    } catch (error) {
        lastError = error;
    }

    try {
        await sendVlcCommand('quit');
        if (!isVlcAlive()) {
            resetVlcState();
            await restoreDisplayWindowForeground('vlc-stopped');
            return { transport: lastError ? 'rc-quit-after-stop-failure' : 'rc' };
        }
    } catch (error) {
        lastError = error;
    }

    const forced = await forceKillVlc();
    await restoreDisplayWindowForeground('vlc-force-stopped');
    return { ...forced, fallbackFrom: lastError?.message || '' };
}

async function launchVlcForSecondary(fullPath) {
    const launchToken = ++vlcLaunchSequence;

    await ensureExclusiveVlcPlayback();

    if (launchToken !== vlcLaunchSequence) {
        const error = new Error('Superseded by newer VLC play request');
        error.code = 'VLC_PLAY_SUPERSEDED';
        throw error;
    }

    const vlcPath = resolveVlcExecutable();
    if (!vlcPath) {
        throw new Error('Percorso VLC non configurato');
    }

    const vlcArgs = [
        '--fullscreen',
        '--play-and-exit',
        '--no-video-title-show',
        '--no-loop',
        '--no-repeat',
        '--extraintf', 'rc',
        '--rc-host', `${VLC_RC_HOST}:${VLC_RC_PORT}`,
        '--rc-quiet',
        fullPath
    ];

    const candidates = [vlcPath, ...getVlcExecutableCandidates().filter((candidate) => candidate !== vlcPath)];
    let lastError = null;

    for (const candidatePath of candidates) {
        if (!candidatePath || !fs.existsSync(candidatePath)) {
            continue;
        }

        try {
            const child = spawn(candidatePath, vlcArgs, { detached: true, stdio: 'ignore' });
            child.unref();
            vlcProcess = child;
            vlcCurrentFile = fullPath;
            attachVlcChildProcess(child, fullPath);
            await forceVlcForeground('play-launch');
            startVlcForegroundGuard();
            return { vlcPath: candidatePath, vlcArgs, fallbackFrom: candidatePath === vlcPath ? '' : vlcPath };
        } catch (error) {
            lastError = error;
            if (!/ENOENT/i.test(String(error?.message || ''))) {
                throw error;
            }
        }
    }

    throw lastError || new Error('Nessun percorso VLC valido trovato');
}

// ===== CONFIGURAZIONE SSE =====
const SSE_CONFIG = {
    heartbeatInterval: 15000,    // Heartbeat ogni 15 secondi
    clientTimeout: 60000,         // Timeout client inattivo 60 secondi
    maxClients: 50,                // Numero massimo di client connessi
    retryDelay: 3000              // Retry delay per il client (ms)
};

// SSE Eventi: client connessi per refresh in tempo reale
const eventiClients = [];
let eventiHeartbeatInterval = null;
let eventiCleanupInterval = null;

function registerEventiClient(res) {
    // Limita il numero massimo di client
    if (eventiClients.length >= SSE_CONFIG.maxClients) {
        console.warn(`Raggiunto limite massimo client (${SSE_CONFIG.maxClients}), rifiuto nuova connessione`);
        res.status(503).json({ error: 'Server sovraccarico, riprova più tardi' });
        return;
    }

    // Aggiungi timestamp per tracking
    res._connectedAt = Date.now();
    res._lastHeartbeat = Date.now();
    eventiClients.push(res);

    res.on('close', () => {
        const index = eventiClients.indexOf(res);
        if (index !== -1) {
            eventiClients.splice(index, 1);
            console.log(`Client SSE disconnesso. Client attivi: ${eventiClients.length}`);
        }
    });

    if (!eventiHeartbeatInterval) {
        eventiHeartbeatInterval = setInterval(() => {
            const heartbeat = `event: heartbeat\ndata: ${JSON.stringify({ 
                time: new Date().toISOString(), 
                clients: eventiClients.length,
                uptime: Math.floor(process.uptime())
            })}\n\n`;
            eventiClients.forEach(client => {
                try {
                    client._lastHeartbeat = Date.now();
                    client.write(heartbeat);
                } catch (err) {
                    console.warn('Errore SSE heartbeat Eventi:', err.message);
                }
            });
        }, SSE_CONFIG.heartbeatInterval);
    }

    // Avvia cleanup periodico per client inattivi
    if (!eventiCleanupInterval) {
        eventiCleanupInterval = setInterval(() => {
            const now = Date.now();
            const stale = eventiClients.filter(c => 
                c._lastHeartbeat && (now - c._lastHeartbeat > SSE_CONFIG.clientTimeout)
            );
            stale.forEach(c => {
                try { c.end(); } catch (e) {}
                const idx = eventiClients.indexOf(c);
                if (idx > -1) eventiClients.splice(idx, 1);
            });
            if (stale.length > 0) {
                console.log(`Rimossi ${stale.length} client SSE stale`);
            }
        }, SSE_CONFIG.clientTimeout / 2);
    }
}

function cleanupEventiHeartbeat() {
    if (eventiClients.length === 0 && eventiHeartbeatInterval) {
        clearInterval(eventiHeartbeatInterval);
        eventiHeartbeatInterval = null;
    }
}

function broadcastEventiUpdate(payload = { type: 'refresh' }) {
    const message = `event: refresh\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of [...eventiClients]) {
        try {
            client.write(message);
        } catch (err) {
            console.warn('Errore broadcast SSE Eventi:', err.message);
        }
    }
    cleanupEventiHeartbeat();
}

// ===== PATHS EVENTI =====
const eventiDataDir = path.join(__dirname, 'Eventi', 'data');
const borderoDBaseDir = path.join(__dirname, 'Bordero', 'data');
const borderoDBasePath = path.join(borderoDBaseDir, 'deejay.csv');
const pathBrani = path.join(eventiDataDir, 'brani.json');
const pathLog = path.join(eventiDataDir, 'log.json');
const pathDj = path.join(eventiDataDir, 'dj.json');
const pathDjLimits = path.join(eventiDataDir, 'dj-limits.json');
const pathCsv = path.join(eventiDataDir, 'log.csv');

// ===== INIZIALIZZAZIONE =====
function initializeEventiFiles() {
    if (!fs.existsSync(eventiDataDir)) {
        fs.mkdirSync(eventiDataDir, { recursive: true });
    }
    if (!fs.existsSync(pathBrani)) fs.writeFileSync(pathBrani, '[]');
    if (!fs.existsSync(pathLog)) fs.writeFileSync(pathLog, '[]');
    if (!fs.existsSync(pathDj)) fs.writeFileSync(pathDj, '[]');
    if (!fs.existsSync(pathDjLimits)) fs.writeFileSync(pathDjLimits, '{}');
}

function loadOpenedViewersFromFile() {
    try {
        if (fs.existsSync(OPENED_VIEWERS_FILE)) {
            const raw = fs.readFileSync(OPENED_VIEWERS_FILE, 'utf8');
            const obj = JSON.parse(raw || '{}');
            if (obj && typeof obj === 'object') {
                openedViewers = obj;
                console.log(`[OK] openedViewers caricati da file (${Object.keys(openedViewers).length} entries)`);
                // Verify PIDs and remove stale entries
                let removed = 0;
                Object.keys(openedViewers).forEach(k => {
                    const pid = parseInt(k, 10);
                    if (isNaN(pid)) { delete openedViewers[k]; removed++; return; }
                    let alive = true;
                    try {
                        process.kill(pid, 0);
                    } catch (e) {
                        if (e.code === 'EPERM') alive = true; else alive = false;
                    }
                    if (!alive) { delete openedViewers[k]; removed++; }
                });
                if (removed > 0) {
                    console.log(`ℹ️ Rimosse ${removed} voci stale da openedViewers`);
                    saveOpenedViewersToFile();
                }
            }
        }
    } catch (err) {
        console.warn('⚠️ Impossibile caricare opened-viewers.json:', err.message);
    }
}

function saveOpenedViewersToFile() {
    try {
        const tmp = OPENED_VIEWERS_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(openedViewers, null, 2), { encoding: 'utf8' });
        fs.renameSync(tmp, OPENED_VIEWERS_FILE);
    } catch (err) {
        console.warn('⚠️ Impossibile salvare opened-viewers.json:', err.message);
    }
}

function isPidRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return e && e.code === 'EPERM' ? true : false;
    }
}

function detectCsvDelimiter(line) {
    if (typeof line !== 'string' || line.trim() === '') {
        return ';';
    }
    const commaCount = (line.match(/,/g) || []).length;
    const semicolonCount = (line.match(/;/g) || []).length;
    if (commaCount === 0 && semicolonCount === 0) {
        return ',';
    }
    return commaCount >= semicolonCount ? ',' : ';';
}

function syncBraniOnStartupV2() {
    try {
        ensureExtraCsvFile();
        const { stats } = syncBraniJson(pathBrani);
        console.log(`Startup sync: ${stats.total} brani caricati dai CSV`);
        console.log(`   - Principale: ${stats.baseCount}`);
        console.log(`   - Aggiuntivo (${EXTRA_CSV_NAME}): ${stats.extraCount}`);
    } catch (e) {
        console.error('Errore sincronizzazione startup:', e);
    }
}

function syncBraniOnStartup() {
    try {
        const csvPath = path.join(__dirname, 'Eventi', 'display.csv');

        if (!fs.existsSync(csvPath)) {
            console.warn('⚠️  CSV non trovato, brani non sincronizzati');
            return;
        }

        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvContent.replace(/\r/g, '').split('\n');
        const headerLine = lines.slice(3).find(l => l.trim()) || '';
        const delimiter = (headerLine.match(/,/g) || []).length >= (headerLine.match(/;/g) || []).length ? ',' : ';';
        const brani = [];

        for (let i = 3; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.split(delimiter);
            const id = cols[1]?.trim();
            const titolo = cols[2]?.trim();
            const brano = cols[3]?.trim();
            const autore = cols[4]?.trim();

            if (id && titolo) {
                brani.push({ id, titolo, brano: brano || '', autore: autore || '' });
            }
        }

        fs.writeFileSync(pathBrani, JSON.stringify(brani, null, 2));
        console.log(`✅ Startup sync: ${brani.length} brani caricati da CSV`);
    } catch (e) {
        console.error('❌ Errore sincronizzazione startup:', e);
    }
}

// ===== MIDDLEWARE =====
app.use(express.json());

// CORS header per permettere connessioni da qualsiasi origin
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Normalize uppercase /EVENTI paths to lowercase so static files and routes resolve.
app.use((req, res, next) => {
    if (/^\/eventi/i.test(req.url) && !req.url.startsWith('/eventi')) {
        req.url = req.url.replace(/^\/eventi/i, '/eventi');
    }
    next();
});

// Serve the Visualizer entry point directly before static middleware.
// This avoids redirect loops on Windows caused by case-insensitive path handling.
app.get('/eventi/visualizer.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Eventi', 'public', 'visualizer.html'));
});

app.get('/eventi/eventi.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Eventi', 'public', 'eventi.html'));
});

app.get('/eventi/public/eventi.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Eventi', 'public', 'eventi.html'));
});

app.get('/eventi/qr.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Eventi', 'public', 'qr.html'));
});

app.get('/eventi/public/qr.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Eventi', 'public', 'qr.html'));
});

// Serve the Eventi landing page for both /eventi and /eventi/.
app.get(['/eventi', '/eventi/'], (req, res) => {
    res.sendFile(path.join(__dirname, 'Eventi', 'public', 'eventi.html'));
});

// Explicitly serve Eventi HTML assets such as /eventi/eventi.html and /eventi/qr.html.
app.get('/eventi/:file', (req, res, next) => {
    const requestedFile = req.params.file;
    if (!requestedFile.includes('.')) {
        return next();
    }

    const fullPath = path.join(__dirname, 'Eventi', 'public', requestedFile);
    console.log(`[eventi-route] request=${req.originalUrl} file=${requestedFile} exists=${fs.existsSync(fullPath)} path=${fullPath}`);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        return res.sendFile(fullPath);
    }

    return next();
});

// Serve static files for Eventi before root static files.
app.use('/eventi', express.static(path.join(__dirname, 'Eventi', 'public')));

// Serve the local videoclip directory for the Bordero pages.
app.use('/videos', express.static(VIDEOCLIP_DIR));
// Serve recordings generated by USERFORM PAGINA05 for Electron secondary playback.
app.use('/userform-recordings', express.static(USERFORM_RECORDINGS_DIR));

app.get('/api/videoclip/list', (req, res) => {
    try {
        if (!fs.existsSync(VIDEOCLIP_DIR)) {
            return res.json({ dir: VIDEOCLIP_DIR, files: [] });
        }

        const entries = fs.readdirSync(VIDEOCLIP_DIR, { withFileTypes: true })
            .filter(entry => entry.isFile())
            .map(entry => entry.name)
            .sort((a, b) => a.localeCompare(b));

        return res.json({ dir: VIDEOCLIP_DIR, files: entries });
    } catch (error) {
        console.error('Errore leggendo directory videoclip:', error);
        return res.status(500).json({ error: error.message, files: [] });
    }
});

async function handleBorderoSyncGoogle(req, res) {
    try {
        const summary = await runBorderoGoogleSync('manual');
        if (summary?.success) {
            return res.json({ ok: true, summary, state: borderoGoogleSyncState });
        }
        return res.status(500).json({ ok: false, summary, state: borderoGoogleSyncState });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error), state: borderoGoogleSyncState });
    }
}

app.post('/api/bordero/sync-google', handleBorderoSyncGoogle);
app.get('/api/bordero/sync-google', handleBorderoSyncGoogle);

app.get('/api/bordero/sync-google/status', (req, res) => {
    res.json({ ok: true, state: borderoGoogleSyncState });
});

app.get('/api/videoclip/play-secondary', async (req, res) => {
    try {
        const videoUrl = req.query.url;
        if (!videoUrl) {
            return res.status(400).json({ success: false, error: 'Missing url parameter' });
        }

        const fullPath = resolveVideoPath(videoUrl);

        if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
            return res.status(404).json({ success: false, error: 'Video file not found', filePath: fullPath });
        }

        const { vlcPath, vlcArgs } = await launchVlcForSecondary(fullPath);

        return res.json({ success: true, filePath: fullPath, vlcPath, vlcArgs });
    } catch (error) {
        console.error('Errore avviando fallback VLC:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/videoclip/vlc/control', async (req, res) => {
    try {
        reconcileVlcProcessState();

        const action = String(req.body?.action || '').toLowerCase();
        const videoUrl = req.body?.url || '';

        if (!action) {
            return res.status(400).json({ success: false, error: 'Missing action' });
        }

        if (action === 'play') {
            if (videoUrl) {
                const fullPath = resolveVideoPath(videoUrl);
                if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
                    return res.status(404).json({ success: false, error: 'Video file not found', filePath: fullPath });
                }

                if (isVlcAlive() && vlcCurrentFile === fullPath) {
                    try {
                        await sendVlcCommand('play');
                        await forceVlcForeground('play-resume-same-file');
                        startVlcForegroundGuard();
                        return res.json({ success: true, action, mode: 'resume', filePath: vlcCurrentFile });
                    } catch (_) {
                        // fallback a relaunch se il canale RC non risponde
                    }
                }

                const launched = await launchVlcForSecondary(fullPath);
                return res.json({ success: true, action, mode: 'launch', filePath: fullPath, vlcPath: launched.vlcPath, vlcArgs: launched.vlcArgs });
            }

            if (!(await ensureVlcTracked())) {
                return res.status(400).json({ success: false, error: 'No running VLC instance and no URL provided' });
            }

            await sendVlcCommand('play');
            await forceVlcForeground('play-resume');
            startVlcForegroundGuard();
            return res.json({ success: true, action, mode: 'resume', filePath: vlcCurrentFile });
        }

        if (action === 'pause') {
            const result = await pauseVlcPlayback();
            return res.json({ success: true, action, filePath: vlcCurrentFile, transport: result.transport });
        }

        if (action === 'stop') {
            const result = await stopVlcPlayback();
            return res.json({ success: true, action, filePath: vlcCurrentFile, transport: result.transport });
        }

        return res.status(400).json({ success: false, error: `Unsupported action: ${action}` });
    } catch (error) {
        if (error?.code === 'VLC_PLAY_SUPERSEDED') {
            return res.status(409).json({ success: false, error: error.message });
        }
        if (error?.code === 'VLC_PAUSE_SUPERSEDED') {
            return res.status(409).json({ success: false, error: error.message });
        }
        console.error('Errore controllo VLC secondario:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/videoclip/vlc/state', async (req, res) => {
    try {
        reconcileVlcProcessState();
        const tracked = await ensureVlcTracked();
        reconcileVlcProcessState();
        const alive = isVlcAlive();
        return res.json({
            success: true,
            alive,
            tracked: Boolean(tracked),
            filePath: vlcCurrentFile || tracked?.filePath || '',
            completion: vlcLastCompletionEvent
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/userform/pagina05/cameras', async (req, res) => {
    try {
        const systemCamera = await ensureSystemWebcamInUserformCsv();
        const cameras = loadUserformCameraProfiles();
        const defaultCameraName = sanitizeCsvValue(systemCamera.detectedName);
        const csvDefault = cameras.find((item) => item.isDefault)?.name || '';
        const resolvedDefault = csvDefault
            || (cameras.some((item) => item.name === defaultCameraName) ? defaultCameraName : '')
            || (cameras[0]?.name || '');

        return res.json({
            ok: true,
            source: USERFORM_CAMERA_CSV,
            count: cameras.length,
            defaultCameraName: resolvedDefault,
            systemCamera,
            cameras
        });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error), cameras: [] });
    }
});

app.post('/api/userform/pagina05/cameras/profile/save', (req, res) => {
    try {
        const cameraName = sanitizeCsvValue(req.body?.cameraName);
        if (!cameraName) {
            return res.status(400).json({ ok: false, error: 'cameraName obbligatorio' });
        }

        const saved = upsertUserformCameraProfile(cameraName, {
            codec: req.body?.codec,
            size: req.body?.size,
            fps: req.body?.fps,
            label: req.body?.label,
            profileId: req.body?.profileId,
            isDefault: req.body?.isDefault,
            isEnabled: req.body?.isEnabled,
            lastUsedAt: req.body?.lastUsedAt,
            lastMode: req.body?.lastMode,
            lastStatus: req.body?.lastStatus,
            usageCount: req.body?.usageCount,
            lastSize: req.body?.lastSize,
            lastFps: req.body?.lastFps,
            lastCodec: req.body?.lastCodec,
            notes: req.body?.notes,
            touchNow: toInputBoolean(req.body?.touchNow, false)
        });

        if (!saved) {
            return res.status(400).json({ ok: false, error: 'Profilo camera non valido' });
        }

        const cameras = loadUserformCameraProfiles();
        return res.json({
            ok: true,
            profile: saved,
            count: cameras.length,
            defaultCameraName: cameras.find((item) => item.isDefault)?.name || ''
        });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.get('/api/userform/pagina05/files', (req, res) => {
    try {
        ensureUserformRecordingDir();
        const mkvFiles = listUserformRecordingFiles(['.mkv']);
        const mp4Files = listUserformRecordingFiles(['.mp4']);
        const allFiles = [...mkvFiles, ...mp4Files]
            .sort((a, b) => Number(b.mtimeMs || 0) - Number(a.mtimeMs || 0))
            .map((item) => ({
                ...item,
                publicUrl: `/userform-recordings/${encodeURIComponent(item.name)}`
            }));

        return res.json({
            ok: true,
            recordingDir: USERFORM_RECORDINGS_DIR,
            legacyDir: LEGACY_RECORDINGS_DIR,
            mkvFiles,
            mp4Files,
            allFiles
        });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error), mkvFiles: [], mp4Files: [], allFiles: [] });
    }
});

app.get('/api/userform/pagina05/state', (req, res) => {
    try {
        const recording = getUserformRecordingState();
        const liveVlc = getUserformLiveVlcState();
        return res.json({
            ok: true,
            recording,
            liveVlc,
            ffmpegPath: resolveFfmpegExecutable(),
            vlcPath: resolveVlcExecutable(),
            recordingDir: USERFORM_RECORDINGS_DIR
        });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.post('/api/userform/pagina05/recording/start', async (req, res) => {
    try {
        const currentState = getUserformRecordingState();
        if (currentState.recording) {
            return res.status(409).json({ ok: false, error: 'Recording already active', state: currentState });
        }

        const ffmpegPath = resolveFfmpegExecutable();
        if (!ffmpegPath) {
            return res.status(500).json({ ok: false, error: 'FFmpeg non trovato. Configura FFMPEG_PATH o installa in C:/FFMPEG/bin/ffmpeg.exe' });
        }

        const cameraName = sanitizeCsvValue(req.body?.cameraName);
        if (!cameraName) {
            return res.status(400).json({ ok: false, error: 'cameraName obbligatorio' });
        }

        const cameraProfiles = loadUserformCameraProfiles();
        const profile = cameraProfiles.find((item) => item.name === cameraName) || {
            name: cameraName,
            codec: sanitizeCsvValue(req.body?.codec),
            size: sanitizeCsvValue(req.body?.size) || '640x480',
            fps: sanitizeCsvValue(req.body?.fps) || '30'
        };

        const recDir = ensureUserformRecordingDir();
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').replace(/\..+/, '');
        const requestedMode = sanitizeCsvValue(req.body?.recordingMode || process.env.USERFORM_RECORDING_MODE || 'direct-mp4');
        const plan = buildUserformRecordingPlan({
            recDir,
            timestamp,
            recordingMode: requestedMode
        });

        const ffArgs = buildCameraCaptureArgs(profile, plan.outputFilePath);

        const child = spawn(ffmpegPath, ffArgs, { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });
        userformRecordingProcess = child;
        userformRecordingFilePath = plan.outputFilePath;
        userformRecordingPlan = plan;

        updateUserformCameraProfileUsage(cameraName, {
            codec: profile.codec,
            size: profile.size,
            fps: profile.fps,
            mode: 'recording',
            status: 'started',
            incrementUsage: true
        });

        child.once('exit', () => {
            if (userformRecordingProcess?.pid === child.pid) {
                userformRecordingProcess = null;
                userformRecordingFilePath = '';
                userformRecordingPlan = null;
            }
        });

        return res.json({
            ok: true,
            recording: true,
            pid: child.pid,
            fileName: plan.targetFileName,
            filePath: plan.targetFilePath,
            sourceFileName: plan.sourceFileName,
            sourceFilePath: plan.sourceFilePath,
            targetFileName: plan.targetFileName,
            targetFilePath: plan.targetFilePath,
            recordingMode: plan.recordingMode,
            convertToMp4OnStop: plan.convertToMp4OnStop,
            ffmpegPath,
            ffmpegArgs: ffArgs,
            profile
        });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.post('/api/userform/pagina05/recording/stop', async (req, res) => {
    try {
        const result = await stopUserformRecordingIfRunning();
        return res.json({
            ok: true,
            ...result,
            state: getUserformRecordingState()
        });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.post('/api/userform/pagina05/convert-play', async (req, res) => {
    try {
        const ffmpegPath = resolveFfmpegExecutable();
        if (!ffmpegPath) {
            return res.status(500).json({ ok: false, error: 'FFmpeg non trovato. Configura FFMPEG_PATH o installa in C:/FFMPEG/bin/ffmpeg.exe' });
        }

        const fileName = sanitizeCsvValue(req.body?.fileName);
        if (!fileName) {
            return res.status(400).json({ ok: false, error: 'fileName obbligatorio' });
        }

        const availableMkv = listUserformRecordingFiles(['.mkv']);
        const source = availableMkv.find((item) => item.name === fileName);
        if (!source) {
            return res.status(404).json({ ok: false, error: `File MKV non trovato: ${fileName}` });
        }

        const baseName = fileName.toLowerCase().endsWith('.mkv') ? fileName.slice(0, -4) : fileName;
        const outputName = `converted_${baseName}.mp4`;
        const outputPath = path.join(path.dirname(source.path), outputName);
        const convertArgs = buildConvertToMp4Args(source.path, outputPath);

        await execFileAsync(ffmpegPath, convertArgs, { maxBuffer: 10 * 1024 * 1024 });

        if (!fs.existsSync(outputPath)) {
            return res.status(500).json({ ok: false, error: 'Conversione completata ma file output non trovato', outputPath });
        }

        const vlcPath = resolveVlcExecutable();
        if (!vlcPath) {
            return res.status(500).json({ ok: false, error: 'VLC non trovato. Configura VLC_PATH o installa VLC' });
        }

        await stopUserformLiveVlc().catch(() => null);
        const launched = await launchVlcForSecondary(outputPath);

        return res.json({
            ok: true,
            sourceFile: source.path,
            outputFile: outputPath,
            ffmpegPath,
            ffmpegArgs: convertArgs,
            vlcPath: launched.vlcPath,
            vlcArgs: launched.vlcArgs
        });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.post('/api/userform/pagina05/electron/live/start', async (req, res) => {
    try {
        const cameraName = sanitizeCsvValue(req.body?.cameraName);
        if (!cameraName) {
            return res.status(400).json({ ok: false, error: 'cameraName obbligatorio' });
        }

        const payload = {
            mode: 'webcam-live',
            cameraName,
            size: sanitizeCsvValue(req.body?.size),
            fps: sanitizeCsvValue(req.body?.fps)
        };

        const result = await callElectronControl('/video-player/play', payload);
        return res.json({ ok: true, ...result });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.post('/api/userform/pagina05/electron/live/stop', async (_req, res) => {
    try {
        const result = await callElectronControl('/video-player/stop', {});
        return res.json({ ok: true, ...result });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.post('/api/userform/pagina05/electron/player/play', async (req, res) => {
    try {
        const videoUrl = sanitizeCsvValue(req.body?.url);
        if (!videoUrl) {
            return res.status(400).json({ ok: false, error: 'url obbligatorio' });
        }

        const result = await callElectronControl('/video-player/play', { url: videoUrl });
        return res.json({ ok: true, ...result });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.get('/api/userform/pagina05/electron/player/state', async (_req, res) => {
    try {
        const result = await callElectronControl('/video-player/state');
        return res.json({ ok: true, ...result });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.post('/api/userform/pagina05/vlc/live/start', async (req, res) => {
    try {
        const vlcPath = resolveVlcExecutable();
        if (!vlcPath) {
            return res.status(500).json({ ok: false, error: 'VLC non trovato. Configura VLC_PATH o installa VLC' });
        }

        const cameraName = sanitizeCsvValue(req.body?.cameraName);
        if (!cameraName) {
            return res.status(400).json({ ok: false, error: 'cameraName obbligatorio' });
        }

        const size = sanitizeCsvValue(req.body?.size);
        const fps = sanitizeCsvValue(req.body?.fps);

        await stopUserformLiveVlc().catch(() => null);

        const args = [
            '--fullscreen',
            '--no-video-title-show',
            'dshow://',
            `:dshow-vdev=${cameraName}`,
            ':dshow-adev=none'
        ];

        if (size) {
            args.push(`:dshow-size=${size}`);
        }
        if (fps) {
            args.push(`:dshow-fps=${fps}`);
        }

        const child = spawnDetachedProcess(vlcPath, args);
        userformLiveVlcProcess = { pid: child.pid };

        updateUserformCameraProfileUsage(cameraName, {
            codec: sanitizeCsvValue(req.body?.codec),
            size,
            fps,
            mode: 'live',
            status: 'started',
            incrementUsage: true
        });

        return res.json({ ok: true, pid: child.pid, vlcPath, vlcArgs: args });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.post('/api/userform/pagina05/vlc/live/stop', async (req, res) => {
    try {
        const result = await stopUserformLiveVlc();
        return res.json({ ok: true, ...result, state: getUserformLiveVlcState() });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.post('/api/userform/pagina05/autotest', async (req, res) => {
    try {
        ensureUserformRecordingDir();
        const ffmpegPath = resolveFfmpegExecutable();
        const vlcPath = resolveVlcExecutable();
        const cameraProfiles = loadUserformCameraProfiles();
        const mkvFiles = listUserformRecordingFiles(['.mkv']);

        return res.json({
            ok: true,
            checks: {
                cameraCsvExists: fs.existsSync(USERFORM_CAMERA_CSV),
                ffmpegFound: Boolean(ffmpegPath),
                vlcFound: Boolean(vlcPath),
                recordingDirExists: fs.existsSync(USERFORM_RECORDINGS_DIR)
            },
            paths: {
                cameraCsv: USERFORM_CAMERA_CSV,
                ffmpegPath,
                vlcPath,
                recordingDir: USERFORM_RECORDINGS_DIR,
                legacyRecordingDir: LEGACY_RECORDINGS_DIR
            },
            summary: {
                cameras: cameraProfiles.length,
                mkvFiles: mkvFiles.length,
                recordingState: getUserformRecordingState(),
                liveVlcState: getUserformLiveVlcState()
            }
        });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/mobile.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

app.get('/mobile1.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

app.get('/public/mobile1.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

app.get('/public/script.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'script.js'));
});

app.get('/public/utility.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'utility.js'));
});

app.use(express.static(path.join(__dirname), {
    index: ['index.html'],
    extensions: ['html', 'htm']
}));

app.get('/diagnostica.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'diagnostica.html'));
});

app.get('/public/diagnostica.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'diagnostica.html'));
});

app.get('/servizio.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'servizio.html'));
});

app.get('/public/servizio.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'servizio.html'));
});

app.get('/ScriptPDF1.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ScriptPDF1.html'));
});

app.get('/public/ScriptPDF1.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ScriptPDF1.html'));
});

app.get('/index0.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index0.html'));
});

app.get('/public/index0.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index0.html'));
});

app.get('/index1.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index1.html'));
});

app.get('/public/index1.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index1.html'));
});

app.get('/index2.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index2.html'));
});

app.get('/public/index2.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index2.html'));
});

app.get('/temp.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'temp.html'));
});

app.get('/public/temp.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'temp.html'));
});

app.get('/display.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

app.get('/public/display.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/public/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/test-csv-loading.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'test-csv-loading.html'));
});

app.get('/public/test-csv-loading.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'test-csv-loading.html'));
});

app.get('/nav.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'nav.html'));
});

app.get('/public/nav.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'nav.html'));
});

app.get('/test-bordero-frontend.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'test-bordero-frontend.html'));
});

app.get('/public/test-bordero-frontend.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'test-bordero-frontend.html'));
});

app.get('/Playlist-country', (req, res) => {
    res.sendFile(path.join(__dirname, 'Playlist-country', 'index.html'));
});

app.get('/Playlist-country/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Playlist-country', 'index.html'));
});

app.get('/NextCoreo1.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'NextCoreo1.html'));
});

app.get('/public/NextCoreo1.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'NextCoreo1.html'));
});

app.get('/NextCoreo2.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'NextCoreo2.html'));
});

app.get('/public/NextCoreo2.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'NextCoreo2.html'));
});

function setBorderoApiCors(res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
}

app.options('/api/bordero/export-siae', (req, res) => {
    setBorderoApiCors(res);
    return res.sendStatus(204);
});

app.options('/api/bordero/download-siae/:fileName', (req, res) => {
    setBorderoApiCors(res);
    return res.sendStatus(204);
});

app.post('/api/bordero/export-siae', (req, res) => {
    try {
        setBorderoApiCors(res);
        const brani = Array.isArray(req.body?.brani) ? req.body.brani : [];
        const evento = sanitizeSiaeEventName(req.body?.evento || req.body?.eventName || '');
        const completed = brani
            .filter(item => String(item?.flag || '').trim().toUpperCase() === 'X')
            .map(item => {
                const titolo = String(item?.titolo || '').replace(/"/g, '').trim();
                const autore = String(item?.autore || '').replace(/"/g, '').trim();
                return { titolo, autore };
            })
            .filter(item => item.titolo || item.autore);

        if (completed.length === 0) {
            return res.status(400).json({ error: 'Nessun record valido da esportare.' });
        }

        completed.sort((left, right) => left.titolo.localeCompare(right.titolo, 'it', { sensitivity: 'base' }));

        const rows = completed.map(item => [item.titolo, item.autore, '', '', ''].join(','));
        const csvContent = ['Titolo,Autore,Compositore,Performer,Durata', ...rows].join('\r\n');

        const now = new Date();
        const gg = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const aaaa = now.getFullYear();
        const hh = String(now.getHours()).padStart(2, '0');
        const mi = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const hhmmss = `${hh}${mi}${ss}`;
        const fileName = `${gg}-${mm}-${aaaa}-${hhmmss}_${evento}_SIAE_VSC.csv`;
        const siaeDir = ensureSiaeExportDir();
        const filePath = getSiaeExportPath(fileName);

        // Match the VBA export semantics: UTF-8 text file with SIAE header and CRLF rows.
        fs.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf8');

        return res.json({
            ok: true,
            count: completed.length,
            fileName,
            filePath,
            downloadUrl: `/api/bordero/download-siae/${encodeURIComponent(fileName)}?t=${Date.now()}`,
        });
    } catch (error) {
        console.error('Errore export Bordero SIAE:', error);
        return res.status(500).json({ error: 'Errore export Bordero SIAE: ' + error.message });
    }
});

app.get('/api/bordero/download-siae/:fileName', (req, res) => {
    setBorderoApiCors(res);
    const fileName = path.basename(req.params.fileName || '');

    if (!fileName) {
        return res.status(400).send('Nome file non valido');
    }

    ensureSiaeExportDir();
    const filePath = getSiaeExportPath(fileName);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File SIAE non trovato');
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    return res.download(filePath);
});

// Logging
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path}`);
    next();
});

// ===== API PDF =====

// Lista PDF
app.get('/api/pdf-list', (req, res) => {
    try {
        console.log(`🔍 Lettura cartella: ${PDF_FOLDER}`);

        if (!fs.existsSync(PDF_FOLDER)) {
            console.warn(`⚠️  Cartella non esiste: ${PDF_FOLDER}`);
            return res.json({
                success: false,
                error: `Cartella non trovata: ${PDF_FOLDER}`,
                files: []
            });
        }

        const allFiles = fs.readdirSync(PDF_FOLDER);
        console.log(`   Trovati ${allFiles.length} file totali`);

        const pdfFiles = allFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
        console.log(`   Di cui ${pdfFiles.length} sono PDF`);

        const files = pdfFiles
            .sort()
            .map(filename => {
                try {
                    const fullPath = path.join(PDF_FOLDER, filename);
                    const stats = fs.statSync(fullPath);

                    return {
                        name: filename,
                        path: fullPath,
                        size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                        created: stats.birthtime.toLocaleString('it-IT')
                    };
                } catch (e) {
                    console.warn(`⚠️  Errore lettura file ${filename}: ${e.message}`);
                    return null;
                }
            })
            .filter(f => f !== null);

        console.log(`✅ Ritorno ${files.length} file PDF validi`);

        res.json({
            success: true,
            timestamp: new Date().toLocaleString('it-IT'),
            folder: PDF_FOLDER,
            totalCount: files.length,
            files: files
        });

    } catch (error) {
        console.error(`❌ Errore API /api/pdf-list: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message,
            files: []
        });
    }
});

// Apri PDF
app.post('/api/open-pdf', (req, res) => {
    try {
        const { filePath } = req.body;

        if (!filePath) {
            return res.status(400).json({
                success: false,
                error: 'filePath non fornito'
            });
        }

        console.log(`📂 Richiesta apertura: ${filePath}`);

        if (!fs.existsSync(filePath)) {
            console.error(`❌ File non trovato: ${filePath}`);
            return res.status(404).json({
                success: false,
                error: `File non trovato: ${filePath}`
            });
        }

        console.log(`✅ File trovato, apertura in corso...`);
        console.log(`🌐 Apertura su monitor secondario`);

        const viewer = req.body.viewer || 'auto';
        const adobePath = req.body.adobePath || '';

        const scriptPath = path.join(__dirname, 'pdf', 'scripts', 'open-pdf-secondary.ps1');
        console.log(`   Script: ${scriptPath}`);
        console.log(`   File: ${filePath}`);
        console.log(`   Viewer: ${viewer} adobePath: ${adobePath}`);

        const args = [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', scriptPath,
            '-FilePath', filePath,
            '-Viewer', viewer,
            '-AdobePath', adobePath
        ];

        const ps = spawn('powershell.exe', args, {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';
        let responseSent = false;
        ps.stdout.on('data', d => { stdout += d.toString(); });
        ps.stderr.on('data', d => { stderr += d.toString(); });

        const timeout = setTimeout(() => {
            if (responseSent) return;
            try {
                responseSent = true;
                res.json({ success: true, message: 'Comando inviato (timeout)', file: filePath, debug: stdout || stderr });
            } catch (e) {}
        }, 4000);

        ps.on('close', code => {
            clearTimeout(timeout);
            console.log(`powershell exited code=${code}`);
            try {
                const out = stdout.trim();
                let parsed = null;
                if (out) {
                    const first = out.match(/\{[\s\S]*\}/);
                    if (first) parsed = JSON.parse(first[0]);
                }

                if (parsed && parsed.pid) {
                    const pid = parseInt(parsed.pid, 10);
                    if (!isNaN(pid)) {
                        openedViewers[pid] = { file: filePath, startedAt: Date.now() };
                        saveOpenedViewersToFile();
                        console.log(`✅ Viewer PID registrato: ${pid}`);
                        if (responseSent) return;
                        responseSent = true;
                        return res.json({ success: true, message: 'PDF aperto sul monitor secondario', file: filePath, pid });
                    }
                }

                if (responseSent) return;
                responseSent = true;
                return res.json({ success: true, message: 'Comando inviato', file: filePath, debug: out || stderr });
            } catch (err) {
                console.error('❌ Errore parsing output PS:', err.message);
                if (responseSent) return;
                responseSent = true;
                return res.json({ success: true, message: 'Comando inviato (no pid)', file: filePath, error: err.message });
            }
        });

    } catch (error) {
        console.error(`❌ Errore API /api/open-pdf: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Chiudi viewer
app.post('/api/close-chrome', (req, res) => {
    try {
        const pids = Object.keys(openedViewers).map(k => parseInt(k, 10)).filter(Boolean);
        const results = [];
        pids.forEach(pid => {
            try {
                process.kill(pid);
                results.push({ pid, status: 'killed' });
            } catch (e) {
                try {
                    spawn('taskkill', ['/PID', pid.toString(), '/T', '/F']);
                    results.push({ pid, status: 'taskkill_sent' });
                } catch (ee) {
                    results.push({ pid, status: 'error', error: ee.message });
                }
            }
        });

        // Clear the map and save
        openedViewers = {};
        saveOpenedViewersToFile();

        res.json({ success: true, results });
    } catch (error) {
        console.error(`❌ Errore API /api/close-chrome: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Lista viewer aperti
app.get('/api/opened-viewers', (req, res) => {
    try {
        const list = Object.keys(openedViewers).map(k => {
            const pid = parseInt(k, 10);
            const data = openedViewers[k];
            const alive = isPidRunning(pid);
            const startedAt = data && data.startedAt ? data.startedAt : null;
            const ageMs = startedAt ? (Date.now() - startedAt) : null;
            return { pid, file: data.file, startedAt, ageMs, alive };
        });
        res.json({ success: true, list });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Health check for PDF client compatibility
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        server: 'unified-server',
        port: PORT,
        pdfFolder: PDF_FOLDER,
        uptime: Math.floor(process.uptime())
    });
});

// Serve PDF files for embedded viewer
app.get('/api/serve-pdf', (req, res) => {
    try {
        const fileParam = req.query.file;
        if (!fileParam) {
            return res.status(400).send('Parametro file mancante');
        }

        const requestedPath = path.resolve(fileParam);
        const allowedRoot = path.resolve(PDF_FOLDER);
        if (requestedPath !== allowedRoot && !requestedPath.startsWith(allowedRoot + path.sep)) {
            return res.status(403).send('Accesso al file non consentito');
        }

        if (!fs.existsSync(requestedPath)) {
            return res.status(404).send('File non trovato');
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="' + path.basename(requestedPath) + '"');
        const stream = fs.createReadStream(requestedPath);
        stream.pipe(res);
        stream.on('error', error => {
            console.error('❌ Errore serve-pdf:', error.message);
            if (!res.headersSent) {
                res.status(500).send('Errore interno server');
            }
        });
    } catch (err) {
        console.error('❌ Errore API /api/serve-pdf:', err.message);
        res.status(500).send(err.message);
    }
});

// ===== API EVENTI =====

// Router per eventi
const router = express.Router();

// Status eventi
app.get('/eventi/api/status', (req, res) => {
    res.json({ ok: true, name: 'EVENTI', port: PORT, uptime: process.uptime() });
});

app.get('/eventi/api/ping', (req, res) => {
    res.json({ ok: true, ping: 'pong' });
});

app.get('/eventi/api/host-ip', (req, res) => {
    const localIp = getLocalIP();
    if (!localIp) {
        return res.status(500).json({ ok: false, error: 'IP locale non trovato' });
    }
    res.json({ ok: true, ip: localIp, port: PORT });
});

app.get('/eventi/api/qr', async (req, res) => {
    try {
        const localIp = getLocalIP();
        if (!localIp) {
            return res.status(500).json({ ok: false, error: 'IP locale non trovato' });
        }
        const url = `http://${localIp}:${PORT}/eventi/eventi.html`;
        const dataUrl = await QRCodeLib.toDataURL(url, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            margin: 1,
            width: 300
        });
        res.json({ ok: true, url, dataUrl });
    } catch (err) {
        console.error('Errore generazione QR:', err);
        res.status(500).json({ ok: false, error: err.message || 'Errore generazione QR' });
    }
});

app.get('/eventi/api/stream', (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no'  // Disabilita buffering nginx
    });

    if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
    }

    // Retry configurabile lato client
    res.write(`retry: ${SSE_CONFIG.retryDelay}\n\n`);
    registerEventiClient(res);
});

// Lista brani
router.get('/brani', (req, res) => {
    try {
        syncBraniJson(pathBrani);
        const brani = JSON.parse(fs.readFileSync(pathBrani, 'utf-8'));
        res.json(brani);
    } catch (e) {
        res.status(500).json({ error: 'Impossibile leggere brani.json' });
    }
});

router.post('/brani-extra', (req, res) => {
    try {
        const result = appendExtraBrano(req.body, pathBrani);
        res.status(201).json({
            ok: true,
            entry: result.entry,
            count: result.stats.total,
            baseCount: result.stats.baseCount,
            extraCount: result.stats.extraCount,
            message: `Coreografia aggiunta in ${EXTRA_CSV_NAME}`
        });
        broadcastEventiUpdate({ type: 'brano-added', entry: result.entry });
    } catch (e) {
        res.status(400).json({ error: e.message || 'Errore inserimento coreografia extra' });
    }
});

// Aggiorna coreografia aggiuntiva
router.post('/aggiuntive/update', (req, res) => {
    try {
        const { id, coreografia, brano, compositore, autore, durata } = req.body;
        
        if (!id) {
            return res.status(400).json({ error: 'ID non fornito' });
        }
        
        const result = updateExtraBrano(id, { coreografia, brano, compositore, autore, durata });
        res.json(result);
    } catch (e) {
        res.status(400).json({ error: e.message || 'Errore aggiornamento coreografia' });
    }
});

router.delete('/aggiuntive/:id', (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: 'ID non fornito' });
        }

        const result = deleteExtraBrano(id);
        res.json(result);
        broadcastEventiUpdate({ type: 'brano-deleted', id });
    } catch (e) {
        res.status(400).json({ error: e.message || 'Errore eliminazione coreografia' });
    }
});

router.post('/aggiuntive/delete', (req, res) => {
    try {
        const { id } = req.body || {};

        if (!id) {
            return res.status(400).json({ error: 'ID non fornito' });
        }

        const result = deleteExtraBrano(id);
        res.json(result);
        broadcastEventiUpdate({ type: 'brano-deleted', id });
    } catch (e) {
        res.status(400).json({ error: e.message || 'Errore eliminazione coreografia' });
    }
});

// Log eventi
router.get('/log', (req, res) => {
    try {
        const log = JSON.parse(fs.readFileSync(pathLog, 'utf-8'));
        res.json(log);
    } catch (e) {
        res.status(500).json({ error: 'Impossibile leggere log.json' });
    }
});

// Salvataggio log
router.post('/log', (req, res) => {
    try {
        const { id, stato, timestamp, dj } = req.body;

        const validStates = ['prenotato', 'eseguito', 'disponibile'];
        const isBoolState = typeof stato === 'boolean';
        const isStringState = typeof stato === 'string' && validStates.includes(stato);

        if (!id || (!isBoolState && !isStringState)) {
            return res.status(400).json({ error: 'Payload non valido' });
        }

        const normalizedState = isBoolState ? (stato ? 'eseguito' : 'disponibile') : stato;

        const log = JSON.parse(fs.readFileSync(pathLog, 'utf-8'));
        log.push({ id, stato: normalizedState, timestamp: timestamp || new Date().toISOString(), dj: dj || null });
        fs.writeFileSync(pathLog, JSON.stringify(log, null, 2));
        res.json({ ok: true });
        broadcastEventiUpdate({ type: 'log-updated' });
    } catch (e) {
        res.status(500).json({ error: 'Errore salvataggio log' });
    }
});

router.post('/log/reset-times', (req, res) => {
    try {
        const log = JSON.parse(fs.readFileSync(pathLog, 'utf-8'));
        const archiveDir = path.join(eventiDataDir, 'archive');

        if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir, { recursive: true });
        }

        if (Array.isArray(log) && log.length > 0) {
            const archiveName = `log-reset-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            fs.writeFileSync(path.join(archiveDir, archiveName), JSON.stringify(log, null, 2));
        }

        fs.writeFileSync(pathLog, JSON.stringify([], null, 2));
        fs.writeFileSync(pathCsv, 'timestamp;id_brano;stato;dj\n');

        res.json({
            ok: true,
            cleared: Array.isArray(log) ? log.length : 0,
            message: 'Date e orari delle coreografie sono stati resettati. Il nuovo evento puo iniziare con cronologia pulita.'
        });
        broadcastEventiUpdate({ type: 'log-reset' });
    } catch (e) {
        res.status(500).json({ error: 'Errore reset date e orari' });
    }
});

// Funzione helper per normalizzazione ordinamento (gestisce numeri, accentate, spazi, simboli)
function normalizeForSort(str) {
    if (!str) return '';
    return str.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // rimuove accenti
        .replace(/[^a-z0-9\s]/g, ''); // mantiene solo lettere, numeri, spazi
}

// Funzione per ottenere i dettagli di un brano dall'archivio
function getBraniDetails(id, braniJson, extraCsvPath) {
    // Cerca prima nei brani normali
    const brano = braniJson.find(b => b.id === id);
    if (brano) {
        return {
            titolo: brano.brano || brano.titolo || '',
            autore: brano.autore || '',
            compositore: '',
            performer: '',
            durata: ''
        };
    }
    
    // Cerca nelle coreografie aggiuntive
    if (fs.existsSync(extraCsvPath)) {
        const extraContent = fs.readFileSync(extraCsvPath, 'utf-8');
        const extraLines = extraContent.split('\n').slice(1); // skip header
        for (const line of extraLines) {
            if (!line.trim()) continue;
            const cols = line.split(',');
            if (cols.length >= 8 && cols[2] === id) {
                return {
                    titolo: cols[4] || '', // brano (colonna 5)
                    autore: cols[6] || '', // autore (colonna 7)
                    compositore: '',
                    performer: '',
                    durata: ''
                };
            }
        }
    }
    
    return null;
}

// Export CSV per SIAE
router.get('/export-csv', (req, res) => {
    try {
        const log = JSON.parse(fs.readFileSync(pathLog, 'utf-8'));
        
        // Filtra solo i brani eseguiti (una sola volta per ID)
        const eseguitiMap = new Map();
        for (const entry of log) {
            if (entry.stato === 'eseguito' || entry.stato === true) {
                if (!eseguitiMap.has(entry.id)) {
                    eseguitiMap.set(entry.id, entry);
                }
            }
        }
        const eseguiti = Array.from(eseguitiMap.values());
        
        // Leggi i brani dall'archivio
        const braniJson = JSON.parse(fs.readFileSync(pathBrani, 'utf-8'));
        const extraCsvPath = path.join(__dirname, 'Eventi', 'Coreografie_Aggiuntive.csv');
        
        // Costruisci i record con i dati disponibili
        const records = [];
        for (const entry of eseguiti) {
            const details = getBraniDetails(entry.id, braniJson, extraCsvPath);
            if (details) {
                records.push(details);
            } else {
                // Brano non trovato, inserisci con ID come titolo
                records.push({
                    titolo: entry.id,
                    autore: '',
                    compositore: '',
                    performer: '',
                    durata: ''
                });
            }
        }
        
        // Ordina alfabeticamente (gestisce numeri, accentate, spazi, simboli)
        records.sort((a, b) => {
            const normA = normalizeForSort(a.titolo);
            const normB = normalizeForSort(b.titolo);
            return normA.localeCompare(normB, 'it');
        });
        
        // Costruisci il CSV in formato SIAE
        const siaeHeader = 'Titolo,Autore,Compositore,Performer,Durata';
        const siaeRows = records.map(r => {
            // Funzione per escapare campi con virgole, virgolette, etc.
            const escapeCsv = (val) => {
                if (!val) return '';
                const str = String(val);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return '"' + str.replace(/"/g, '""') + '"';
                }
                return str;
            };
            return [
                escapeCsv(r.titolo),
                escapeCsv(r.autore),
                escapeCsv(r.compositore),
                escapeCsv(r.performer),
                escapeCsv(r.durata)
            ].join(',');
        });
        
        const csvContent = [siaeHeader, ...siaeRows].join('\n');
        
        // Determina il nome del file CSV
        let csvPath;
        if (req.query.siae === '1') {
            // Formato GG-MM-AAAA-HHHH_SIAE_VSC.csv in c:\VSC_SIAE\
            const now = new Date();
            const gg = String(now.getDate()).padStart(2, '0');
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const aaaa = now.getFullYear();
            const hhhh = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
            const siaeFileName = `${gg}-${mm}-${aaaa}-${hhhh}_SIAE_VSC.csv`;
            ensureSiaeExportDir();
            csvPath = getSiaeExportPath(siaeFileName);
        } else {
            csvPath = pathCsv;
        }
        
        // Scrivi in UTF-8
        fs.writeFileSync(csvPath, csvContent, 'utf-8');
        const downloadUrl = '/eventi/api/download-siae/' + encodeURIComponent(path.basename(csvPath)) + '?t=' + Date.now();
        res.json({ ok: true, csv: downloadUrl, count: records.length });
    } catch (e) {
        console.error('Errore export CSV SIAE:', e);
        res.status(500).json({ error: 'Errore export CSV: ' + e.message });
    }
});

// Download CSV (supporta sia log.csv che file SIAE)
router.get('/log.csv', (req, res) => {
    const siaeDir = ensureSiaeExportDir();
    
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    // Se esiste il file log.csv originale, servilo
    if (fs.existsSync(pathCsv)) {
        return res.download(pathCsv);
    }
    // Altrimenti cerca l'ultimo file SIAE in c:\VSC_SIAE\
    if (fs.existsSync(siaeDir)) {
        const files = fs.readdirSync(siaeDir).filter(f => f.endsWith('_SIAE_VSC.csv'));
        if (files.length > 0) {
            files.sort();
            return res.download(path.join(siaeDir, files[files.length - 1]));
        }
    }
    return res.status(404).send('CSV non generato');
});

router.get('/download-siae/:fileName', (req, res) => {
    const fileName = path.basename(req.params.fileName || '');

    if (!fileName) {
        return res.status(400).send('Nome file non valido');
    }

    ensureSiaeExportDir();
    const filePath = getSiaeExportPath(fileName);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File SIAE non trovato');
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    return res.download(filePath);
});

router.get('/sync-brani', (req, res) => {
    try {
        ensureExtraCsvFile();
        const { stats } = syncBraniJson(pathBrani);
        res.json({
            ok: true,
            count: stats.total,
            baseCount: stats.baseCount,
            extraCount: stats.extraCount,
            skippedInvalid: stats.skippedInvalid,
            skippedDuplicates: stats.skippedDuplicates,
            extraFile: EXTRA_CSV_NAME,
            message: `Sincronizzati ${stats.total} brani da CSV`
        });
    } catch (e) {
        res.status(500).json({ error: 'Errore sincronizzazione brani: ' + e.message });
    }
});

// Sync brani da CSV
router.get('/sync-brani-legacy', (req, res) => {
    try {
        const csvPath = path.join(__dirname, 'Eventi', 'display.csv');

        if (!fs.existsSync(csvPath)) {
            return res.status(404).json({ error: 'CSV file not found' });
        }

        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvContent.replace(/\r/g, '').split('\n');
        const headerLine = lines.slice(3).find(l => l.trim()) || '';
        const delimiter = (headerLine.match(/,/g) || []).length >= (headerLine.match(/;/g) || []).length ? ',' : ';';
        const brani = [];

        for (let i = 3; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.split(delimiter);
            const id = cols[1]?.trim();
            const titolo = cols[2]?.trim();
            const brano = cols[3]?.trim();
            const autore = cols[4]?.trim();

            if (id && titolo) {
                brani.push({
                    id,
                    titolo,
                    brano: brano || '',
                    autore: autore || ''
                });
            }
        }

        fs.writeFileSync(pathBrani, JSON.stringify(brani, null, 2));
        res.json({
            ok: true,
            count: brani.length,
            message: `Sincronizzati ${brani.length} brani da CSV`
        });
    } catch (e) {
        res.status(500).json({ error: 'Errore sincronizzazione brani: ' + e.message });
    }
});

// Lista DJ
router.get('/dj', (req, res) => {
    try {
        const dj = JSON.parse(fs.readFileSync(pathDj, 'utf-8'));
        res.json(dj);
    } catch (e) {
        res.status(500).json({ error: 'Impossibile leggere dj.json' });
    }
});

// Aggiungi DJ
router.post('/dj', (req, res) => {
    try {
        const { nome } = req.body;
        if (!nome || typeof nome !== 'string' || !nome.trim()) {
            return res.status(400).json({ error: 'Nome DJ non valido' });
        }

        const dj = JSON.parse(fs.readFileSync(pathDj, 'utf-8'));
        if (dj.some(d => d.nome.toLowerCase() === nome.toLowerCase())) {
            return res.status(400).json({ error: 'DJ gia esiste' });
        }

        const newDj = {
            id: 'dj-' + Date.now(),
            nome: nome.trim(),
            createdAt: new Date().toISOString()
        };

        dj.push(newDj);
        fs.writeFileSync(pathDj, JSON.stringify(dj, null, 2));
        res.json(newDj);
    } catch (e) {
        res.status(500).json({ error: 'Errore aggiunta DJ: ' + e.message });
    }
});

// Rimuovi DJ
router.delete('/dj/:id', (req, res) => {
    try {
        const dj = JSON.parse(fs.readFileSync(pathDj, 'utf-8'));
        const filtered = dj.filter(d => d.id !== req.params.id);

        if (filtered.length === dj.length) {
            return res.status(404).json({ error: 'DJ non trovato' });
        }

        fs.writeFileSync(pathDj, JSON.stringify(filtered, null, 2));
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'Errore rimozione DJ' });
    }
});

// Salva la lista DJ nel file CSV di sorgente Borderò
router.post('/bordero/dj-source', (req, res) => {
    try {
        const isLegacyDBaseNoise = (value) => {
            const text = String(value || '').trim();
            if (!text) return true;
            if (/^https?:\/\//i.test(text)) return true;
            if (/^(x|select)$/i.test(text)) return true;
            if (/^(base|intermedio|avanzato|super avanzato|gold|altre coreo|coppia|3 persone|4 persone|two step|halloween|natalizia|stage|contra|sigla chiusura)$/i.test(text)) return true;
            if (/^(line dance|contra dance|couple\/circle dance|empty)$/i.test(text)) return true;
            if (/^modulo\s+\d+/i.test(text)) return true;
            return false;
        };

        const payload = Array.isArray(req.body?.dj) ? req.body.dj : [];
        const names = payload
            .map((entry) => String(entry?.nome || entry?.name || '').trim())
            .filter(Boolean)
            .filter((name) => !isLegacyDBaseNoise(name))
            .filter((name, index, array) => array.indexOf(name) === index);

        if (names.length === 0) {
            return res.status(400).json({
                ok: false,
                error: 'Nessun DJ valido da salvare: payload sembra contenere righe legacy dBase'
            });
        }

        if (!fs.existsSync(borderoDBaseDir)) {
            fs.mkdirSync(borderoDBaseDir, { recursive: true });
        }

        const csvLines = ['nome,tipologia', ...names.map((name) => `${name},DeeJay`)];
        const csvContent = csvLines.join('\n');
        fs.writeFileSync(borderoDBasePath, csvContent, 'utf8');

        res.json({ ok: true, count: names.length, file: borderoDBasePath });
    } catch (e) {
        res.status(500).json({ error: 'Errore salvataggio sorgente DJ: ' + e.message });
    }
});

// ============================
//    GET: LIMITI PRENOTAZIONI DJ
// ============================
router.get('/dj-limits', (req, res) => {
  try {
    let limits = {};
    if (fs.existsSync(pathDjLimits)) {
      limits = JSON.parse(fs.readFileSync(pathDjLimits, 'utf-8'));
    }

    const log = JSON.parse(fs.readFileSync(pathLog, 'utf-8'));
    const lastStateById = new Map();
    log.forEach((entry, index) => {
      const timestamp = new Date(entry.timestamp || 0).getTime();
      const previous = lastStateById.get(entry.id);
      if (!previous || timestamp > previous.timestamp || (timestamp === previous.timestamp && index > previous.__order)) {
        lastStateById.set(entry.id, { ...entry, timestamp, __order: index });
      }
    });

    const prenotazioniPerDJ = {};
    lastStateById.forEach(entry => {
      if (entry.stato === 'prenotato' && entry.dj) {
        prenotazioniPerDJ[entry.dj] = (prenotazioniPerDJ[entry.dj] || 0) + 1;
      }
    });

    const result = {};
    for (const dj of Object.keys(limits)) {
      result[dj] = {
        limite: limits[dj]?.limite ?? 0,
        prenotazioni: prenotazioniPerDJ[dj] || 0
      };
    }
    for (const dj of Object.keys(prenotazioniPerDJ)) {
      if (!result[dj]) {
        result[dj] = { limite: 0, prenotazioni: prenotazioniPerDJ[dj] };
      }
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Impossibile leggere limiti DJ' });
  }
});

// ============================
//    POST: IMPOSTA LIMITE DJ
// ============================
router.post('/dj-limits', (req, res) => {
  try {
    const { dj, limite } = req.body;
    if (!dj || typeof dj !== 'string') {
      return res.status(400).json({ error: 'Nome DJ non valido' });
    }
    if (typeof limite !== 'number' || limite < 0) {
      return res.status(400).json({ error: 'Limite non valido' });
    }

    let limits = {};
    if (fs.existsSync(pathDjLimits)) {
      limits = JSON.parse(fs.readFileSync(pathDjLimits, 'utf-8'));
    }

    limits[dj] = { limite };
    fs.writeFileSync(pathDjLimits, JSON.stringify(limits, null, 2));

    res.json({ ok: true, dj, limite });
  } catch (e) {
    res.status(500).json({ error: 'Errore salvataggio limite DJ' });
  }
});

// ============================
//    POST: VERIFICA LIMITE PRENOTAZIONE
// ============================
router.post('/check-prenotazione-limit', (req, res) => {
  try {
    const { dj } = req.body;
    if (!dj) {
      return res.status(400).json({ error: 'DJ non specificato' });
    }

    let limits = {};
    if (fs.existsSync(pathDjLimits)) {
      limits = JSON.parse(fs.readFileSync(pathDjLimits, 'utf-8'));
    }

    const limite = limits[dj]?.limite ?? 0;
    const log = JSON.parse(fs.readFileSync(pathLog, 'utf-8'));
    const lastStateById = new Map();
    log.forEach((entry, index) => {
      const timestamp = new Date(entry.timestamp || 0).getTime();
      const previous = lastStateById.get(entry.id);
      if (!previous || timestamp > previous.timestamp || (timestamp === previous.timestamp && index > previous.__order)) {
        lastStateById.set(entry.id, { ...entry, timestamp, __order: index });
      }
    });
    const prenotazioni = Array.from(lastStateById.values()).filter(e => e.stato === 'prenotato' && e.dj === dj).length;
    const canPrenot = limite === 0 || prenotazioni < limite;

    res.json({
      canPrenot,
      dj,
      limite,
      prenotazioni,
      remaining: limite === 0 ? null : Math.max(0, limite - prenotazioni)
    });
  } catch (e) {
    res.status(500).json({ error: 'Errore verifica limite' });
  }
});

// Mount Eventi API router
app.use('/eventi/api', router);

initializeEventiFiles();
loadOpenedViewersFromFile();
syncBraniOnStartupV2();
startBorderoGoogleSyncScheduler();

// ===== AVVIO SERVER =====
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

function startServer(port, maxRetries = 5) {
    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => {
            const localIP = getLocalIP();
            console.log('\n' + '='.repeat(80));
            console.log('🚀 UNIFIED SERVER - Server consolidato avviato');
            console.log('='.repeat(80));
            console.log(`📍 Server: http://localhost:${port}`);
            console.log(`📍 Rete:   http://${localIP}:${port}`);
            console.log(`\n📌 Accesso:`);
            console.log(`   🌐 Web:     http://localhost:${port}/`);
            console.log(`   📄 PDF API: http://localhost:${port}/api/pdf-list`);
            console.log(`   🎵 Eventi:  http://localhost:${port}/eventi/eventi.html`);
            console.log('='.repeat(80) + '\n');
            PORT = port;
            resolve(server);
        });

        server.on('error', async (err) => {
            if (err.code === 'EADDRINUSE' && maxRetries > 0) {
                const nextPort = port + 1;
                console.warn(`⚠️ Porta ${port} occupata, provo porta ${nextPort}...`);
                setTimeout(() => {
                    startServer(nextPort, maxRetries - 1)
                        .then(resolve)
                        .catch(reject);
                }, 250);
                return;
            }
            reject(err);
        });
    });
}

startServer(PORT).catch((err) => {
    console.error('❌ Impossibile avviare il server:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.error(`   La porta ${PORT} è già in uso. Chiudi l'altra applicazione o imposta UNIFIED_PORT su una porta libera.`);
    }
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    if (borderoGoogleSyncTimer) {
        clearInterval(borderoGoogleSyncTimer);
        borderoGoogleSyncTimer = null;
    }
    console.log('\n[STOP] Unified Server fermato');
    process.exit(0);
});
