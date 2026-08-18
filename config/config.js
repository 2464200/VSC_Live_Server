const fs = require('fs');
const path = require('path');

function resolvePortablePath(candidate, fallback) {
  if (!candidate || typeof candidate !== 'string') return fallback;
  const trimmed = candidate.trim();
  if (!trimmed) return fallback;
  if (trimmed === '.' || trimmed === './') return path.resolve(__dirname, '..');
  return path.isAbsolute(trimmed) ? trimmed : path.resolve(process.cwd(), trimmed);
}

const projectRoot = path.resolve(__dirname, '..');

const config = {
  projectRoot,
  port: Number(process.env.UNIFIED_PORT || 5500),
  pdfFolder: resolvePortablePath(process.env.VSC_SCRIPT_PDF_DIR, path.join(projectRoot, 'pdf')),
  videoClipDir: resolvePortablePath(process.env.VSC_VIDEOCLIP_PATH, path.join(projectRoot, 'videos')),
  siaeExportDir: resolvePortablePath(process.env.VSC_SIAE_DIR || process.env.SIAE_EXPORT_DIR, path.join(projectRoot, 'exports', 'siae')),
  userformRecordingsDir: resolvePortablePath(process.env.USERFORM_RECORDINGS_DIR, path.join(projectRoot, 'userform-recordings')),
  legacyRecordingsDir: resolvePortablePath(process.env.LEGACY_RECORDINGS_DIR, path.join(projectRoot, 'legacy-recordings')),
  electronControlPort: Number(process.env.ELECTRON_CONTROL_PORT || 5512),
  ffmpegCandidates: [
    process.env.FFMPEG_PATH,
    'C:/FFMPEG/bin/ffmpeg.exe',
    'C:/ffmpeg/bin/ffmpeg.exe',
    path.join(process.env.ProgramFiles || 'C:/Program Files', 'FFmpeg', 'bin', 'ffmpeg.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'FFmpeg', 'bin', 'ffmpeg.exe')
  ].filter(Boolean),
  ensureDirs() {
    for (const dir of [
      this.pdfFolder,
      this.videoClipDir,
      this.siaeExportDir,
      this.userformRecordingsDir,
      this.legacyRecordingsDir
    ]) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (error) {
        console.warn('[config] impossibile creare directory:', dir, error.message);
      }
    }
  }
};

config.ensureDirs();

module.exports = { projectConfig: config };
