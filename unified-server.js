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

require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');
const net = require('net');
const os = require('os');
const { parse: parseCsv } = require('csv-parse/sync');
const QRCodeLib = require('qrcode');
const { projectConfig } = require('./config/config');
const { forwardVdjRequest } = require('./vdj-proxy');
const { syncBraniJson, appendExtraBrano, updateExtraBrano, deleteExtraBrano, EXTRA_CSV_NAME, ensureExtraCsvFile } = require('./Eventi/brani-utils');
const { syncAll: syncGoogleSheetsData } = require('./Bordero/server/google-sheets-sync');
const { getBranoMatchProfile, resolveMusicArchiveMatch } = require('./Bordero/server/music-archive-match');

const app = express();
let PORT = Number.isFinite(Number(process.env.UNIFIED_PORT)) ? Number(process.env.UNIFIED_PORT) : projectConfig.port;
const PDF_FOLDER = projectConfig.pdfFolder;
const VIDEOCLIP_DIR = projectConfig.videoClipDir;
const BORDERO_DATA_DIR = path.join(__dirname, 'Bordero', 'data');
const BORDERO_CSV_FILES = {
    brani: path.join(BORDERO_DATA_DIR, 'brani.csv'),
    comuni: path.join(BORDERO_DATA_DIR, 'comuni_italia.csv'),
    location: path.join(BORDERO_DATA_DIR, 'location.csv'),
    locationOptions: path.join(BORDERO_DATA_DIR, 'location_popup_options.csv')
};
// Directory condivisa export SIAE (Bordero + Eventi).
// Priorita: variabile ambiente -> default storico progetto -> percorso portabile di progetto.
const SIAE_EXPORT_DIR = projectConfig.siaeExportDir;
const USERFORM_CAMERA_CSV = path.join(__dirname, 'Bordero', 'data', 'get-camera-name.csv');
const USERFORM_RECORDINGS_DIR = projectConfig.userformRecordingsDir;
const LEGACY_RECORDINGS_DIR = projectConfig.legacyRecordingsDir;
const ELECTRON_CONTROL_PORT = process.env.ELECTRON_CONTROL_PORT ? parseInt(process.env.ELECTRON_CONTROL_PORT, 10) : projectConfig.electronControlPort;
const USERFORM_FFMPEG_CANDIDATES = [
    process.env.FFMPEG_PATH,
    projectConfig.ffmpegCandidates[0],
    projectConfig.ffmpegCandidates[1],
    ...(projectConfig.ffmpegCandidates.slice(2))
].filter(Boolean);
const BORDERO_GOOGLE_SYNC_ENABLED = String(process.env.BORDERO_GOOGLE_SYNC_ENABLED || 'true').toLowerCase() !== 'false';
const BORDERO_GOOGLE_SYNC_INTERVAL_MS = 60 * 1000;
const MUSIC_ARCHIVE_CONFIG_FILE = path.join(__dirname, 'Bordero', 'data', 'music-archive-config.json');
const MUSIC_ARCHIVE_LOCAL_CONFIG_FILE = path.join(__dirname, 'Bordero', 'data', 'music-archive-local-config.json');
const VIDEOCLIP_LOCAL_CONFIG_FILE = path.join(__dirname, 'Bordero', 'data', 'video-clip-local-config.json');
const MUSIC_ARCHIVE_INDEX_CSV_FILE = path.join(__dirname, 'Bordero', 'data', 'music-archive-index.csv');
const MUSIC_ARCHIVE_BASE_DIR = __dirname;
const MUSIC_ARCHIVE_ALLOWED_EXTENSIONS = new Set([
    '.mp3', '.wav', '.flac', '.m4a', '.m4p', '.mp4', '.m4v', '.mov', '.avi', '.mkv', '.wmv',
    '.aiff', '.aac', '.ogg', '.wma', '.opus', '.alac', '.mp2', '.mpga', '.mpeg', '.mpg',
    '.mid', '.midi', '.ape'
]);
const MUSIC_ARCHIVE_CACHE_TTL_MS = 30 * 1000;

function normalizeVideoClipPath(candidate = '') {
    const value = String(candidate || '').trim();
    return value && path.isAbsolute(value) ? path.normalize(value) : '';
}

function readVideoClipConfig() {
    try {
        if (!fs.existsSync(VIDEOCLIP_LOCAL_CONFIG_FILE)) return { rootPath: VIDEOCLIP_DIR, updatedAt: null };
        const raw = fs.readFileSync(VIDEOCLIP_LOCAL_CONFIG_FILE, 'utf8').replace(/^\uFEFF/, '').trim();
        const parsed = raw ? JSON.parse(raw) : {};
        return { rootPath: normalizeVideoClipPath(parsed?.rootPath) || VIDEOCLIP_DIR, updatedAt: parsed?.updatedAt || null };
    } catch (error) {
        console.warn('⚠️ Lettura config locale VideoClip fallita:', error?.message || error);
        return { rootPath: VIDEOCLIP_DIR, updatedAt: null };
    }
}

function writeVideoClipConfig(rootPath) {
    const payload = { rootPath: normalizeVideoClipPath(rootPath), updatedAt: new Date().toISOString() };
    fs.mkdirSync(path.dirname(VIDEOCLIP_LOCAL_CONFIG_FILE), { recursive: true });
    fs.writeFileSync(VIDEOCLIP_LOCAL_CONFIG_FILE, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
}

function getVideoClipDir() {
    return readVideoClipConfig().rootPath;
}

function normalizeTextForMatch(value = '') {
    let text = String(value || '').trim();
    if (!text) return '';

    try {
        text = text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    } catch (_) {
        text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    return text
        .toLowerCase()
        .replace(/&/g, ' e ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenizeTextForMatch(normalizedText = '') {
    return String(normalizedText || '')
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= 2);
}

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
let userformRecordingStartedAt = 0;
let userformLastRecordingSnapshot = null;
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

let musicArchiveIndexCache = {
    rootPath: '',
    scannedAt: 0,
    files: []
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

function normalizeMusicArchiveRelativePath(value = '') {
    const raw = String(value || '').trim().replace(/^"+|"+$/g, '');
    if (!raw) {
        return '';
    }

    if (path.isAbsolute(raw) || path.win32.isAbsolute(raw)) {
        return '';
    }

    const normalized = path.normalize(raw.replace(/[\\/]+/g, path.sep));
    if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith(`..${path.sep}`)) {
        return '';
    }

    return normalized.split(path.sep).join('/');
}

function normalizeMusicArchiveLocalPath(value = '') {
    const raw = String(value || '').trim().replace(/^"+|"+$/g, '');
    if (!raw || (!path.isAbsolute(raw) && !path.win32.isAbsolute(raw))) {
        return '';
    }

    return path.normalize(raw);
}

function resolveMusicArchiveRootPath(relativePath = '') {
    const normalized = normalizeMusicArchiveRelativePath(relativePath);
    if (!normalized) {
        return '';
    }

    const resolved = path.resolve(MUSIC_ARCHIVE_BASE_DIR, normalized);
    const relativeToBase = path.relative(MUSIC_ARCHIVE_BASE_DIR, resolved);
    if (!relativeToBase || relativeToBase === '..' || relativeToBase.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToBase)) {
        return '';
    }

    return resolved;
}

function toMusicArchiveRelativePath(absolutePath = '') {
    const relative = path.relative(MUSIC_ARCHIVE_BASE_DIR, absolutePath);
    return normalizeMusicArchiveRelativePath(relative);
}

function getWindowsDriveRoots() {
    const roots = [];
    if (process.platform === 'win32') {
        for (let drive = 67; drive <= 90; drive += 1) {
            const candidate = `${String.fromCharCode(drive)}:\\`;
            try {
                if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
                    roots.push(candidate);
                }
            } catch (error) {
                // ignore
            }
        }
    }

    if (!roots.length) {
        const home = os.homedir();
        if (home) {
            roots.push(home);
        }
    }

    return roots.sort((left, right) => left.localeCompare(right));
}

function listMusicArchiveDirectories(targetPath = '') {
    const rawTarget = String(targetPath || '').trim();
    const localTarget = normalizeMusicArchiveLocalPath(rawTarget);
    const normalizedTarget = localTarget ? '' : normalizeMusicArchiveRelativePath(rawTarget);
    const absoluteTarget = localTarget || (normalizedTarget
        ? resolveMusicArchiveRootPath(normalizedTarget)
        : MUSIC_ARCHIVE_BASE_DIR);
    const isLocalTarget = Boolean(localTarget);

    if (!absoluteTarget || !fs.existsSync(absoluteTarget) || !fs.statSync(absoluteTarget).isDirectory()) {
        return {
            path: localTarget || normalizedTarget,
            parentPath: isLocalTarget ? path.dirname(localTarget) : (normalizedTarget ? toMusicArchiveRelativePath(path.dirname(absoluteTarget || MUSIC_ARCHIVE_BASE_DIR)) : ''),
            entries: []
        };
    }

    const entries = fs.readdirSync(absoluteTarget, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({
            name: entry.name,
            path: isLocalTarget
                ? path.join(absoluteTarget, entry.name)
                : toMusicArchiveRelativePath(path.join(absoluteTarget, entry.name)),
            isDirectory: true
        }))
        .sort((left, right) => left.name.localeCompare(right.name));

    if (!rawTarget) {
        getWindowsDriveRoots().forEach((root) => {
            entries.push({ name: root, path: root, isDirectory: true });
        });
    }

    return {
        path: localTarget || normalizedTarget,
        parentPath: isLocalTarget
            ? (path.dirname(localTarget) === localTarget ? '' : path.dirname(localTarget))
            : (normalizedTarget ? toMusicArchiveRelativePath(path.dirname(absoluteTarget)) : ''),
        entries
    };
}

function readMusicArchiveConfig() {
    try {
        if (!fs.existsSync(MUSIC_ARCHIVE_CONFIG_FILE)) {
            return { rootPath: '', updatedAt: null };
        }

        const raw = fs.readFileSync(MUSIC_ARCHIVE_CONFIG_FILE, 'utf8').replace(/^\uFEFF/, '').trim();
        if (!raw) {
            return { rootPath: '', updatedAt: null };
        }

        const parsed = JSON.parse(raw);
        const rootPath = normalizeMusicArchiveRelativePath(parsed?.rootPath || '');
        if (parsed?.rootPath && !rootPath) {
            console.warn('⚠️ Config archivio brani ignorata: il percorso deve essere relativo alla root del progetto.');
            return { rootPath: '', updatedAt: null };
        }
        return {
            rootPath,
            updatedAt: parsed?.updatedAt || null
        };
    } catch (error) {
        console.warn('⚠️ Lettura config archivio brani fallita:', error?.message || error);
        return { rootPath: '', updatedAt: null };
    }
}

function writeMusicArchiveConfig(rootPath) {
    const normalized = normalizeMusicArchiveRelativePath(rootPath);
    const payload = {
        rootPath: normalized,
        updatedAt: new Date().toISOString()
    };

    fs.mkdirSync(path.dirname(MUSIC_ARCHIVE_CONFIG_FILE), { recursive: true });
    fs.writeFileSync(MUSIC_ARCHIVE_CONFIG_FILE, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
}

function readMusicArchiveLocalConfig() {
    try {
        if (!fs.existsSync(MUSIC_ARCHIVE_LOCAL_CONFIG_FILE)) {
            return { rootPath: '', updatedAt: null };
        }

        const raw = fs.readFileSync(MUSIC_ARCHIVE_LOCAL_CONFIG_FILE, 'utf8').replace(/^\uFEFF/, '').trim();
        const parsed = raw ? JSON.parse(raw) : {};
        return {
            rootPath: normalizeMusicArchiveLocalPath(parsed?.rootPath || ''),
            updatedAt: parsed?.updatedAt || null
        };
    } catch (error) {
        console.warn('⚠️ Lettura config locale archivio brani fallita:', error?.message || error);
        return { rootPath: '', updatedAt: null };
    }
}

function writeMusicArchiveLocalConfig(rootPath) {
    const normalized = normalizeMusicArchiveLocalPath(rootPath);
    const payload = {
        rootPath: normalized,
        updatedAt: new Date().toISOString()
    };

    fs.mkdirSync(path.dirname(MUSIC_ARCHIVE_LOCAL_CONFIG_FILE), { recursive: true });
    fs.writeFileSync(MUSIC_ARCHIVE_LOCAL_CONFIG_FILE, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
}

function removeMusicArchiveLocalConfig() {
    if (fs.existsSync(MUSIC_ARCHIVE_LOCAL_CONFIG_FILE)) {
        fs.unlinkSync(MUSIC_ARCHIVE_LOCAL_CONFIG_FILE);
    }
}

function readActiveMusicArchiveConfig() {
    const localConfig = readMusicArchiveLocalConfig();
    if (localConfig.rootPath) {
        return {
            rootPath: localConfig.rootPath,
            resolvedRootPath: localConfig.rootPath,
            scope: 'local',
            updatedAt: localConfig.updatedAt
        };
    }

    const projectConfig = readMusicArchiveConfig();
    return {
        rootPath: projectConfig.rootPath,
        resolvedRootPath: resolveMusicArchiveRootPath(projectConfig.rootPath),
        scope: 'project',
        updatedAt: projectConfig.updatedAt
    };
}

function escapeCsvField(value = '') {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function formatSiaeField(value = '') {
    return String(value ?? '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/,/g, ' ')
        .replace(/"/g, '')
        .trim();
}

function writeMusicArchiveIndexCsv(rootPath, files, scannedAt = Date.now()) {
    const rows = Array.isArray(files) ? files : [];
    const scannedAtIso = new Date(scannedAt).toISOString();
    fs.mkdirSync(path.dirname(MUSIC_ARCHIVE_INDEX_CSV_FILE), { recursive: true });

    const header = [
        'rootPath',
        'scannedAt',
        'relativePath',
        'fileName',
        'baseName',
        'fullPath',
        'extension',
        'size',
        'modifiedAt'
    ].map(escapeCsvField).join(',');

    const content = [header].concat(rows.map((file) => [
        rootPath,
        scannedAtIso,
        file.relativePath || '',
        file.fileName || '',
        file.baseName || '',
        file.fullPath || '',
        path.extname(file.fileName || '').toLowerCase(),
        file.size ?? '',
        file.modifiedAt || ''
    ].map(escapeCsvField).join(','))).join('\n');

    fs.writeFileSync(MUSIC_ARCHIVE_INDEX_CSV_FILE, content, 'utf8');
    return {
        csvPath: MUSIC_ARCHIVE_INDEX_CSV_FILE,
        csvCount: rows.length,
        csvUpdatedAt: scannedAtIso
    };
}

function listMusicFilesRecursive(rootPath) {
    const files = [];
    const stack = [rootPath];

    while (stack.length > 0) {
        const current = stack.pop();
        let entries = [];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch (_) {
            continue;
        }

        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
            }

            if (!entry.isFile()) continue;

            const ext = path.extname(entry.name).toLowerCase();
            if (!MUSIC_ARCHIVE_ALLOWED_EXTENSIONS.has(ext)) continue;

            let stats = null;
            try {
                stats = fs.statSync(fullPath);
            } catch (_) {
                continue;
            }

            const relativePath = path.relative(rootPath, fullPath);
            const baseName = path.basename(entry.name, ext);
            const normalizedName = normalizeTextForMatch(baseName);

            files.push({
                fullPath,
                relativePath,
                fileName: entry.name,
                baseName,
                size: stats?.size || 0,
                modifiedAt: stats?.mtime ? stats.mtime.toISOString() : '',
                normalizedName,
                tokens: tokenizeTextForMatch(normalizedName)
            });
        }
    }

    files.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'it'));
    return files;
}

function refreshMusicArchiveIndex(force = false) {
    const config = readActiveMusicArchiveConfig();
    const rootPath = config.rootPath;
    const resolvedRootPath = config.resolvedRootPath;
    const now = Date.now();

    if (!rootPath) {
        musicArchiveIndexCache = { rootPath: '', scannedAt: 0, files: [] };
        writeMusicArchiveIndexCsv('', [], now);
        return {
            rootPath: '',
            files: [],
            scannedAt: 0,
            exists: false,
            csvPath: MUSIC_ARCHIVE_INDEX_CSV_FILE,
            csvCount: 0,
            csvUpdatedAt: new Date(now).toISOString()
        };
    }

    const exists = Boolean(resolvedRootPath) && fs.existsSync(resolvedRootPath) && fs.statSync(resolvedRootPath).isDirectory();
    if (!exists) {
        musicArchiveIndexCache = { rootPath, scannedAt: now, files: [] };
        writeMusicArchiveIndexCsv(rootPath, [], now);
        return {
            rootPath,
            files: [],
            scannedAt: now,
            exists: false,
            csvPath: MUSIC_ARCHIVE_INDEX_CSV_FILE,
            csvCount: 0,
            csvUpdatedAt: new Date(now).toISOString()
        };
    }

    const cacheIsValid = !force
        && musicArchiveIndexCache.rootPath === rootPath
        && Array.isArray(musicArchiveIndexCache.files)
        && (now - musicArchiveIndexCache.scannedAt) < MUSIC_ARCHIVE_CACHE_TTL_MS;

    if (cacheIsValid) {
        return {
            rootPath,
            files: musicArchiveIndexCache.files,
            scannedAt: musicArchiveIndexCache.scannedAt,
            exists: true,
            csvPath: MUSIC_ARCHIVE_INDEX_CSV_FILE,
            csvCount: Array.isArray(musicArchiveIndexCache.files) ? musicArchiveIndexCache.files.length : 0,
            csvUpdatedAt: new Date(musicArchiveIndexCache.scannedAt).toISOString()
        };
    }

    const files = listMusicFilesRecursive(resolvedRootPath);
    writeMusicArchiveIndexCsv(rootPath, files, now);
    musicArchiveIndexCache = {
        rootPath,
        scannedAt: now,
        files
    };

    return {
        rootPath,
        files,
        scannedAt: now,
        exists: true,
        csvPath: MUSIC_ARCHIVE_INDEX_CSV_FILE,
        csvCount: files.length,
        csvUpdatedAt: new Date(now).toISOString()
    };
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
    return path.join(getVideoClipDir(), fileName);
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

    // If no candidate exists on disk, return empty string so callers handle missing VLC.
    return '';
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

function isLikelyVirtualCameraName(name = '') {
    return /(virtual|splitter|obs|xsplit|manycam|ndi)/i.test(String(name || ''));
}

function parseCameraCapabilitiesFromDshow(outputText = '') {
    const lines = String(outputText || '').split(/\r?\n/);
    const capabilities = [];

    for (const line of lines) {
        const match = line.match(/(?:pixel_format|vcodec)=([^\s]+).*?max s=(\d+)x(\d+) fps=([\d.]+)/i);
        if (!match) {
            continue;
        }

        const codec = sanitizeCsvValue(match[1]).toLowerCase();
        const width = Number.parseInt(match[2], 10);
        const height = Number.parseInt(match[3], 10);
        const fps = Number.parseFloat(match[4]);
        if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(fps)) {
            continue;
        }

        capabilities.push({
            codec,
            width,
            height,
            fps
        });
    }

    return capabilities;
}

function scoreCameraCapability(cap = {}) {
    const width = Number(cap.width) || 0;
    const height = Number(cap.height) || 0;
    const fps = Number(cap.fps) || 0;
    const codec = sanitizeCsvValue(cap.codec).toLowerCase();

    const area = Math.max(0, width * height);
    const fpsWeight = Math.max(0.15, Math.min(fps, 60) / 30);
    const codecBonus = codec === 'mjpeg' ? 250000 : codec === 'h264' ? 200000 : codec === 'yuyv422' ? 100000 : 0;
    return (area * fpsWeight) + codecBonus;
}

function chooseBestCameraCapability(capabilities = []) {
    if (!Array.isArray(capabilities) || capabilities.length === 0) {
        return null;
    }

    let best = capabilities[0];
    let bestScore = scoreCameraCapability(best);
    for (let i = 1; i < capabilities.length; i += 1) {
        const candidate = capabilities[i];
        const candidateScore = scoreCameraCapability(candidate);
        if (candidateScore > bestScore) {
            best = candidate;
            bestScore = candidateScore;
        }
    }

    return best;
}

function formatCapabilityFps(fps) {
    const value = Number(fps);
    if (!Number.isFinite(value) || value <= 0) {
        return '';
    }
    if (Math.abs(value - Math.round(value)) < 0.001) {
        return String(Math.round(value));
    }
    return String(value.toFixed(2)).replace(/\.00$/, '');
}

async function probeBestCapabilityForDevice(ffmpegPath = '', cameraName = '') {
    const normalizedName = sanitizeCsvValue(cameraName);
    if (!ffmpegPath || !normalizedName) {
        return {
            name: normalizedName,
            capability: null,
            error: 'Nome camera o FFmpeg non valido'
        };
    }

    try {
        const { stderr, stdout } = await execFileAsync(ffmpegPath, [
            '-hide_banner',
            '-f', 'dshow',
            '-list_options', 'true',
            '-i', `video=${normalizedName}`
        ], { maxBuffer: 4 * 1024 * 1024 });

        const capabilities = parseCameraCapabilitiesFromDshow(`${stderr || ''}\n${stdout || ''}`);
        return {
            name: normalizedName,
            capability: chooseBestCameraCapability(capabilities),
            error: ''
        };
    } catch (error) {
        const stderr = String(error?.stderr || '');
        const stdout = String(error?.stdout || '');
        const capabilities = parseCameraCapabilitiesFromDshow(`${stderr}\n${stdout}`);
        return {
            name: normalizedName,
            capability: chooseBestCameraCapability(capabilities),
            error: error?.message || String(error)
        };
    }
}

function buildAutodetectedCameraProfile(cameraName = '', capability = null, options = {}) {
    const normalizedName = sanitizeCsvValue(cameraName);
    const cap = capability || {};
    const codec = sanitizeCsvValue(cap.codec).toLowerCase() || 'mjpeg';
    const width = Number(cap.width) || 1280;
    const height = Number(cap.height) || 720;
    const fps = formatCapabilityFps(cap.fps) || '30';
    const size = `${width}x${height}`;
    const nowIso = new Date().toISOString();

    return {
        name: normalizedName,
        codec,
        size,
        fps,
        label: sanitizeCsvValue(options.label) || `Sistema - ${normalizedName}`,
        profileId: sanitizeCsvValue(options.profileId) || ensureProfileId(normalizedName),
        isDefault: Boolean(options.isDefault),
        isEnabled: Object.prototype.hasOwnProperty.call(options, 'isEnabled') ? Boolean(options.isEnabled) : true,
        lastUsedAt: sanitizeCsvValue(options.lastUsedAt),
        lastMode: sanitizeCsvValue(options.lastMode),
        lastStatus: sanitizeCsvValue(options.lastStatus) || 'detected-capabilities',
        usageCount: Number.isFinite(Number(options.usageCount)) ? Math.max(0, Number(options.usageCount)) : 0,
        lastSize: size,
        lastFps: fps,
        lastCodec: codec,
        notes: sanitizeCsvValue(options.notes) || `Profilo auto-aggiornato da FFmpeg (${nowIso})`
    };
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

async function detectSystemWebcamsWithProfilesFromFfmpeg() {
    const detection = await detectSystemWebcamFromFfmpeg();
    const ffmpegPath = sanitizeCsvValue(detection.ffmpegPath);
    const allCandidates = Array.isArray(detection.candidates) ? detection.candidates : [];
    const physicalCandidates = allCandidates.filter((name) => !isLikelyVirtualCameraName(name));
    const preferred = choosePreferredSystemWebcam(physicalCandidates.length ? physicalCandidates : allCandidates);

    if (!ffmpegPath) {
        return {
            detectedName: preferred,
            candidates: allCandidates,
            physicalCandidates,
            ffmpegPath: '',
            probed: [],
            error: detection.error || 'FFmpeg non trovato'
        };
    }

    const probed = [];
    for (const cameraName of physicalCandidates) {
        // Sequential probing avoids overloading dshow on systems with multiple devices.
        // eslint-disable-next-line no-await-in-loop
        const probe = await probeBestCapabilityForDevice(ffmpegPath, cameraName);
        probed.push(probe);
    }

    return {
        detectedName: preferred,
        candidates: allCandidates,
        physicalCandidates,
        ffmpegPath,
        probed,
        error: detection.error || ''
    };
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
    const detection = await detectSystemWebcamsWithProfilesFromFfmpeg();
    const detectedName = sanitizeCsvValue(detection.detectedName);
    const physicalCandidates = Array.isArray(detection.physicalCandidates) ? detection.physicalCandidates : [];

    if (!physicalCandidates.length) {
        return {
            added: false,
            updated: false,
            addedCount: 0,
            updatedCount: 0,
            detectedName,
            candidates: detection.candidates || [],
            physicalCandidates,
            profiled: [],
            error: detection.error || ''
        };
    }

    const profiles = loadUserformCameraProfiles(true);
    const hasDefault = profiles.some((item) => item.isDefault);
    const preferredName = choosePreferredSystemWebcam(physicalCandidates);

    let addedCount = 0;
    let updatedCount = 0;
    const profiled = [];
    const comparisons = [];

    for (const cameraName of physicalCandidates) {
        const existingIndex = profiles.findIndex((item) => item.name.toLowerCase() === cameraName.toLowerCase());
        const existing = existingIndex >= 0 ? profiles[existingIndex] : null;
        const before = existing
            ? {
                codec: sanitizeCsvValue(existing.codec),
                size: sanitizeCsvValue(existing.size),
                fps: sanitizeCsvValue(existing.fps)
            }
            : { codec: '', size: '', fps: '' };
        const probe = (detection.probed || []).find((item) => sanitizeCsvValue(item.name).toLowerCase() === cameraName.toLowerCase()) || null;
        const autoProfile = buildAutodetectedCameraProfile(cameraName, probe?.capability, {
            label: existing?.label || `Sistema - ${cameraName}`,
            profileId: existing?.profileId,
            isEnabled: existing ? existing.isEnabled !== false : true,
            isDefault: existing ? existing.isDefault : (!hasDefault && cameraName === preferredName),
            usageCount: existing?.usageCount || 0,
            lastUsedAt: existing?.lastUsedAt || '',
            lastMode: existing?.lastMode || '',
            lastStatus: 'detected-capabilities',
            notes: existing?.notes || ''
        });

        if (existing) {
            const changed = existing.codec !== autoProfile.codec
                || existing.size !== autoProfile.size
                || existing.fps !== autoProfile.fps
                || existing.lastCodec !== autoProfile.lastCodec
                || existing.lastSize !== autoProfile.lastSize
                || existing.lastFps !== autoProfile.lastFps
                || existing.lastStatus !== autoProfile.lastStatus;
            profiles[existingIndex] = {
                ...existing,
                ...autoProfile,
                isDefault: existing.isDefault,
                usageCount: existing.usageCount
            };
            if (changed) {
                updatedCount += 1;
            }

            comparisons.push({
                name: cameraName,
                before,
                recommended: {
                    codec: autoProfile.codec,
                    size: autoProfile.size,
                    fps: autoProfile.fps
                },
                after: {
                    codec: profiles[existingIndex].codec,
                    size: profiles[existingIndex].size,
                    fps: profiles[existingIndex].fps
                },
                changed,
                added: false,
                probeError: probe?.error || ''
            });
        } else {
            profiles.push(autoProfile);
            addedCount += 1;

            comparisons.push({
                name: cameraName,
                before,
                recommended: {
                    codec: autoProfile.codec,
                    size: autoProfile.size,
                    fps: autoProfile.fps
                },
                after: {
                    codec: autoProfile.codec,
                    size: autoProfile.size,
                    fps: autoProfile.fps
                },
                changed: true,
                added: true,
                probeError: probe?.error || ''
            });
        }

        profiled.push({
            name: cameraName,
            codec: autoProfile.codec,
            size: autoProfile.size,
            fps: autoProfile.fps,
            probeError: probe?.error || ''
        });
    }

    saveUserformCameraProfiles(profiles);

    return {
        added: addedCount > 0,
        updated: updatedCount > 0,
        addedCount,
        updatedCount,
        detectedName,
        candidates: detection.candidates || [],
        physicalCandidates,
        profiled,
        comparisons,
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
        startedAt: alive && userformRecordingStartedAt ? userformRecordingStartedAt : 0,
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

function getUserformRecordedFileInfo(filePath = '') {
    const normalized = String(filePath || '').trim();
    if (!normalized) {
        return { exists: false, path: '', name: '', sizeBytes: 0 };
    }

    const resolved = path.resolve(normalized);
    try {
        const stats = fs.statSync(resolved);
        if (!stats.isFile()) {
            return { exists: false, path: resolved, name: path.basename(resolved), sizeBytes: 0 };
        }
        return {
            exists: true,
            path: resolved,
            name: path.basename(resolved),
            sizeBytes: Number(stats.size || 0)
        };
    } catch (_) {
        return { exists: false, path: resolved, name: path.basename(resolved), sizeBytes: 0 };
    }
}

async function waitForUserformRecordedFile(filePath = '', { attempts = 16, delayMs = 250, minSizeBytes = 1 } = {}) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const info = getUserformRecordedFileInfo(filePath);
        if (info.exists && info.sizeBytes >= minSizeBytes) {
            return { ok: true, ...info, attempts: attempt + 1 };
        }

        if (attempt < attempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    return { ok: false, ...getUserformRecordedFileInfo(filePath), attempts };
}

async function waitForUserformRecordedFileStable(filePath = '', {
    attempts = 28,
    delayMs = 250,
    minSizeBytes = 1,
    stableChecks = 2
} = {}) {
    let previousSize = -1;
    let stableCount = 0;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const info = getUserformRecordedFileInfo(filePath);
        if (info.exists && info.sizeBytes >= minSizeBytes) {
            if (info.sizeBytes === previousSize) {
                stableCount += 1;
            } else {
                stableCount = 0;
            }

            previousSize = info.sizeBytes;

            if (stableCount >= stableChecks) {
                return { ok: true, stable: true, ...info, attempts: attempt + 1 };
            }
        }

        if (attempt < attempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    const fallback = getUserformRecordedFileInfo(filePath);
    return {
        ok: Boolean(fallback.exists && fallback.sizeBytes >= minSizeBytes),
        stable: false,
        ...fallback,
        attempts
    };
}

function setLastUserformRecordingSnapshot(plan, startedAt = 0) {
    if (!plan) return;
    userformLastRecordingSnapshot = {
        plan: { ...plan },
        startedAt: Number(startedAt || 0),
        stoppedAt: 0
    };
}

async function stopUserformRecordingIfRunning() {
    const recordedFilePath = userformRecordingFilePath || '';
    const currentPlan = userformRecordingPlan;
    const currentStartedAt = Number(userformRecordingStartedAt || 0);
    const fallbackSnapshot = userformLastRecordingSnapshot;

    if (!userformRecordingProcess?.pid) {
        userformRecordingProcess = null;
        userformRecordingFilePath = '';
        userformRecordingPlan = null;
        userformRecordingStartedAt = 0;

        const fallbackPath = fallbackSnapshot?.plan?.targetFilePath || fallbackSnapshot?.plan?.outputFilePath || recordedFilePath;
        if (fallbackPath) {
            const fileCheck = await waitForUserformRecordedFileStable(fallbackPath, { attempts: 12, delayMs: 250, minSizeBytes: 1, stableChecks: 1 });
            if (fileCheck.ok) {
                return {
                    stopped: true,
                    startedAt: Number(fallbackSnapshot?.startedAt || 0),
                    durationMs: Number(fallbackSnapshot?.startedAt || 0) ? Math.max(0, Date.now() - Number(fallbackSnapshot.startedAt)) : 0,
                    filePath: fileCheck.path || fallbackPath,
                    finalFilePath: fileCheck.path || fallbackPath,
                    finalFileName: fileCheck.name || path.basename(fallbackPath || ''),
                    sourceFilePath: fallbackSnapshot?.plan?.sourceFilePath || '',
                    targetFilePath: fallbackSnapshot?.plan?.targetFilePath || '',
                    recordingMode: fallbackSnapshot?.plan?.recordingMode || '',
                    graceful: true,
                    fileVerified: true,
                    fileSizeBytes: Number(fileCheck.sizeBytes || 0),
                    verificationNote: fileCheck.stable
                        ? 'Processo gia terminato: file MP4 finale gia presente e stabile su disco.'
                        : 'Processo gia terminato: file MP4 presente su disco (stabilizzazione non confermata).'
                };
            }
        }

        return { stopped: false, filePath: recordedFilePath, fileVerified: false, fileSizeBytes: 0 };
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
        userformRecordingStartedAt = 0;
        const fileCheck = await waitForUserformRecordedFileStable(currentPlan?.targetFilePath || recordedFilePath, { attempts: 16, delayMs: 250, minSizeBytes: 1, stableChecks: 1 });
        return {
            stopped: true,
            pid,
            startedAt: currentStartedAt,
            durationMs: currentStartedAt ? Math.max(0, Date.now() - currentStartedAt) : 0,
            filePath: fileCheck.path || recordedFilePath,
            finalFilePath: fileCheck.path || recordedFilePath,
            finalFileName: fileCheck.name || path.basename(recordedFilePath || ''),
            fileVerified: Boolean(fileCheck.ok),
            fileSizeBytes: Number(fileCheck.sizeBytes || 0),
            verificationNote: fileCheck.ok
                ? (fileCheck.stable ? 'File finale rilevato e stabile dopo uscita processo gia avvenuta.' : 'File finale rilevato dopo uscita processo gia avvenuta.')
                : 'File finale non verificato dopo uscita processo gia avvenuta.'
        };
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
        userformRecordingStartedAt = 0;
        let conversion = null;
        let finalFilePath = currentPlan?.targetFilePath || recordedFilePath;
        let finalFileName = path.basename(finalFilePath || '') || '';
        let fileVerified = false;
        let fileSizeBytes = 0;
        let verificationNote = '';

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

        if (conversion?.ok) {
            const fileCheck = await waitForUserformRecordedFileStable(conversion.targetFilePath || currentPlan?.targetFilePath || recordedFilePath);
            finalFilePath = fileCheck.path || conversion.targetFilePath || finalFilePath;
            finalFileName = fileCheck.name || path.basename(finalFilePath || '') || finalFileName;
            fileVerified = Boolean(fileCheck.ok);
            fileSizeBytes = Number(fileCheck.sizeBytes || 0);
            verificationNote = fileCheck.ok
                ? (fileCheck.stable ? 'File MP4 convertito, finalizzato e verificato su disco.' : 'File MP4 convertito e verificato su disco.')
                : 'Conversione dichiarata completata ma file finale non verificato su disco.';
        } else if (!currentPlan?.convertToMp4OnStop) {
            const fileCheck = await waitForUserformRecordedFileStable(currentPlan?.targetFilePath || recordedFilePath);
            finalFilePath = fileCheck.path || finalFilePath;
            finalFileName = fileCheck.name || path.basename(finalFilePath || '') || finalFileName;
            fileVerified = Boolean(fileCheck.ok);
            fileSizeBytes = Number(fileCheck.sizeBytes || 0);
            verificationNote = fileCheck.ok
                ? (fileCheck.stable ? 'File MP4 diretto finalizzato e verificato su disco dopo stop pulito.' : 'File MP4 diretto verificato su disco dopo stop pulito.')
                : 'Stop pulito completato ma file MP4 finale non verificato su disco.';
        } else {
            verificationNote = conversion?.error
                ? `Conversione MP4 non riuscita: ${conversion.error}`
                : 'Nessuna conversione MP4 eseguita.';
        }

        userformRecordingPlan = null;
        return {
            stopped: true,
            pid,
            startedAt: currentStartedAt,
            durationMs: currentStartedAt ? Math.max(0, Date.now() - currentStartedAt) : 0,
            filePath: finalFilePath || (conversion?.ok ? conversion.targetFilePath : recordedFilePath),
            finalFilePath,
            finalFileName,
            sourceFilePath: currentPlan?.sourceFilePath || '',
            targetFilePath: currentPlan?.targetFilePath || '',
            recordingMode: currentPlan?.recordingMode || '',
            conversion,
            graceful: true,
            fileVerified,
            fileSizeBytes,
            verificationNote
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
    userformRecordingStartedAt = 0;
    const finalCandidatePath = currentPlan?.targetFilePath || recordedFilePath;
    const fileCheck = await waitForUserformRecordedFileStable(finalCandidatePath, { attempts: 8, delayMs: 250, minSizeBytes: 1, stableChecks: 1 });
    return {
        stopped: true,
        pid,
        startedAt: currentStartedAt,
        durationMs: currentStartedAt ? Math.max(0, Date.now() - currentStartedAt) : 0,
        filePath: fileCheck.path || recordedFilePath,
        finalFilePath: fileCheck.path || finalCandidatePath,
        finalFileName: fileCheck.name || path.basename(finalCandidatePath || recordedFilePath || ''),
        sourceFilePath: currentPlan?.sourceFilePath || '',
        targetFilePath: currentPlan?.targetFilePath || '',
        recordingMode: currentPlan?.recordingMode || '',
        graceful: false,
        fileVerified: Boolean(fileCheck.ok),
        fileSizeBytes: Number(fileCheck.sizeBytes || 0),
        verificationNote: fileCheck.ok
            ? (fileCheck.stable ? 'Stop forzato: file finale rilevato su disco (integrita da verificare).' : 'Stop forzato: file finale rilevato ma integrita da verificare.')
            : 'Stop forzato: file finale non verificato su disco.'
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
            // Spawn and wait briefly for either 'spawn' or 'error' event so we don't miss async errors
            const child = spawn(candidatePath, vlcArgs, { detached: true, stdio: 'ignore' });

            try {
                await new Promise((resolve, reject) => {
                    let settled = false;
                    const onSpawn = () => { if (!settled) { settled = true; resolve(); } };
                    const onError = (err) => { if (!settled) { settled = true; reject(err); } };

                    child.once('spawn', onSpawn);
                    child.once('error', onError);

                    // Safety timeout: assume spawned if no error within 500ms
                    setTimeout(() => { if (!settled) { settled = true; resolve(); } }, 500);
                });
            } catch (err) {
                lastError = err;
                // If error is not ENOENT propagate
                if (!/ENOENT/i.test(String(err?.message || ''))) {
                    throw err;
                }
                // otherwise continue to next candidate
                continue;
            }

            // If we reach here, the child was spawned successfully (or assumed spawned)
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
const pathEventMeta = path.join(eventiDataDir, 'event-meta.json');

// ===== INIZIALIZZAZIONE =====
function initializeEventiFiles() {
    if (!fs.existsSync(eventiDataDir)) {
        fs.mkdirSync(eventiDataDir, { recursive: true });
    }
    if (!fs.existsSync(pathBrani)) fs.writeFileSync(pathBrani, '[]');
    if (!fs.existsSync(pathLog)) fs.writeFileSync(pathLog, '[]');
    if (!fs.existsSync(pathDj)) fs.writeFileSync(pathDj, '[]');
    if (!fs.existsSync(pathDjLimits)) fs.writeFileSync(pathDjLimits, '{}');
    if (!fs.existsSync(pathEventMeta)) fs.writeFileSync(pathEventMeta, JSON.stringify({ eventName: '', updatedAt: null }, null, 2));
}

function normalizeEventName(value) {
    return (value || '').toString().trim().slice(0, 90);
}

function readEventMeta() {
    try {
        const payload = JSON.parse(fs.readFileSync(pathEventMeta, 'utf-8'));
        return {
            eventName: normalizeEventName(payload?.eventName),
            updatedAt: payload?.updatedAt || null
        };
    } catch (e) {
        return { eventName: '', updatedAt: null };
    }
}

function writeEventMeta(eventName) {
    const payload = {
        eventName: normalizeEventName(eventName),
        updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(pathEventMeta, JSON.stringify(payload, null, 2));
    return payload;
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

function escapeBorderoCsvValue(value) {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function borderoJsonToCsv(rows, headers = null) {
    if (!Array.isArray(rows) || rows.length === 0) return '';
    const columns = headers || Object.keys(rows[0]);
    return [
        columns.map(escapeBorderoCsvValue).join(','),
        ...rows.map((row) => columns.map((column) => escapeBorderoCsvValue(row?.[column])).join(','))
    ].join('\n') + '\n';
}

function validateBorderoSyncPayload(req, res) {
    const { data } = req.body || {};
    if (!Array.isArray(data)) {
        res.status(400).json({ error: 'Dati non validi. Inviare array di oggetti in body.data' });
        return null;
    }
    if (data.length === 0) {
        res.status(400).json({ error: 'Nessun dato da sincronizzare' });
        return null;
    }
    return data;
}

async function writeBorderoCsv(res, data, filePath, label, headers = null) {
    try {
        await fs.promises.mkdir(BORDERO_DATA_DIR, { recursive: true });
        await fs.promises.writeFile(filePath, borderoJsonToCsv(data, headers), 'utf8');
        return res.json({
            success: true,
            message: `✅ ${data.length} ${label} sincronizzati`,
            file: filePath,
            rows: data.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error(`❌ Errore sync ${label}:`, error);
        return res.status(500).json({ error: error.message, path: filePath });
    }
}

async function readBorderoCsvRows(filePath) {
    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        return parseCsv(content, { columns: true, skip_empty_lines: true, bom: true });
    } catch (_) {
        return [];
    }
}

function preserveBorderoRichieste(nextRows, existingRows) {
    const existingById = new Map(existingRows.map((row) => [String(row.id || '').trim(), row.richieste]));
    return nextRows.map((row) => {
        const id = String(row.id || '').trim();
        if (id && (row.richieste === undefined || row.richieste === '') && existingById.has(id)) {
            return { ...row, richieste: existingById.get(id) };
        }
        return row;
    });
}

async function handleBorderoCsvSync(req, res, type) {
    const data = validateBorderoSyncPayload(req, res);
    if (!data) return;

    if (type === 'dbase') {
        return res.status(410).json({
            success: false,
            error: 'Endpoint deprecato: deejay.csv non viene piu sincronizzato da dBase Excel.',
            hint: 'Usare la gestione DJ in ADMIN e l\'endpoint /api/bordero/dj-source.',
            timestamp: new Date().toISOString()
        });
    }

    const filePath = BORDERO_CSV_FILES[type];
    if (!filePath) return res.status(404).json({ error: `Tipo di sincronizzazione non supportato: ${type}` });
    const rows = type === 'brani'
        ? preserveBorderoRichieste(data, await readBorderoCsvRows(filePath))
        : data;
    const label = type === 'locationOptions' ? 'opzioni Location' : type;
    const headers = type === 'locationOptions' ? ['group', 'parent', 'value'] : null;
    return writeBorderoCsv(res, rows, filePath, label, headers);
}

for (const [legacyType, currentType] of Object.entries({
    brani: 'brani',
    comuni: 'comuni',
    dbase: 'dbase',
    location: 'location',
    'location-options': 'locationOptions'
})) {
    app.post(`/api/sync/${legacyType}`, (req, res) => handleBorderoCsvSync(req, res, currentType));
}

for (const currentType of ['brani', 'comuni', 'location', 'location-options']) {
    app.post(`/api/bordero/sync-${currentType}`, (req, res) => {
        const normalizedType = currentType === 'location-options' ? 'locationOptions' : currentType;
        return handleBorderoCsvSync(req, res, normalizedType);
    });
}

app.get('/api/status', (req, res) => {
    res.json({
        server: 'unified-server',
        port: PORT,
        status: 'online',
        timestamp: new Date().toISOString()
    });
});

// VirtualDJ proxy must be available before any generic routing/404 handling.
app.get('/api/vdj/proxy', async (req, res) => {
    try {
        const baseUrl = String(req.query.baseUrl || 'http://localhost:8080').trim();
        const endpoint = String(req.query.endpoint || '/query').trim();
        const script = req.query.script !== undefined
            ? String(req.query.script).trim()
            : undefined;
        const timeoutMs = Number(req.query.timeoutMs || 4000);
        const baseUrlsParam = req.query.baseUrls || req.query.baseUrlList || '';
        const baseUrls = String(baseUrlsParam || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        const result = await forwardVdjRequest({
            baseUrl,
            baseUrls,
            endpoint,
            script,
            timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 4000
        });
        res.status(result.statusCode >= 400 ? result.statusCode : 200).type('text/plain').send(result.body);
    } catch (error) {
        console.error('Errore proxy VirtualDJ:', error);
        res.status(502).type('text/plain').send(error.message || 'Proxy VirtualDJ fallito');
    }
});

app.get('/api/vdj/test', async (req, res) => {
    try {
        const result = await forwardVdjRequest({
            baseUrl: 'http://127.0.0.1:8080',
            endpoint: '/query',
            script: 'get_clock',
            timeoutMs: 4000
        });
        res.status(result.statusCode >= 400 ? result.statusCode : 200).type('text/plain').send(result.body);
    } catch (error) {
        res.status(502).type('text/plain').send(error.message || 'Test VirtualDJ fallito');
    }
});

app.get('/api/music-archive/config', (req, res) => {
    try {
        const config = readActiveMusicArchiveConfig();
        const normalized = config.rootPath;
        const resolvedRootPath = config.resolvedRootPath;
        const exists = Boolean(resolvedRootPath) && fs.existsSync(resolvedRootPath) && fs.statSync(resolvedRootPath).isDirectory();
        return res.json({
            ok: true,
            rootPath: normalized,
            exists,
            scope: config.scope,
            updatedAt: config.updatedAt || null
        });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.post('/api/music-archive/config', (req, res) => {
    try {
        const rawRootPath = req.body?.rootPath || '';
        const rootPath = normalizeMusicArchiveRelativePath(rawRootPath);
        const localRootPath = rootPath ? '' : normalizeMusicArchiveLocalPath(rawRootPath);
        const selectedRootPath = localRootPath || rootPath;
        const resolvedRootPath = localRootPath || resolveMusicArchiveRootPath(rootPath);
        if (!selectedRootPath || !resolvedRootPath) {
            return res.status(400).json({ ok: false, error: 'Indica una cartella del progetto o una cartella locale valida' });
        }

        if (!resolvedRootPath || !fs.existsSync(resolvedRootPath) || !fs.statSync(resolvedRootPath).isDirectory()) {
            return res.status(400).json({ ok: false, error: 'La cartella indicata non esiste o non e valida' });
        }

        const saved = localRootPath
            ? writeMusicArchiveLocalConfig(localRootPath)
            : writeMusicArchiveConfig(rootPath);
        if (!localRootPath) {
            removeMusicArchiveLocalConfig();
        }
        refreshMusicArchiveIndex(true);
        return res.json({ ok: true, rootPath: saved.rootPath, scope: localRootPath ? 'local' : 'project', updatedAt: saved.updatedAt });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.get('/api/music-archive/directories', (req, res) => {
    try {
        const targetPath = String(req.query.path || '').trim();
        const payload = listMusicArchiveDirectories(targetPath);
        return res.json({ ok: true, ...payload });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.get('/api/music-archive/status', (req, res) => {
    try {
        const force = String(req.query.refresh || '').toLowerCase() === '1';
        const index = refreshMusicArchiveIndex(force);
        return res.json({
            ok: true,
            rootPath: index.rootPath,
            exists: index.exists,
            fileCount: Array.isArray(index.files) ? index.files.length : 0,
            scannedAt: index.scannedAt || 0,
            csvPath: index.csvPath || MUSIC_ARCHIVE_INDEX_CSV_FILE,
            csvCount: index.csvCount ?? (Array.isArray(index.files) ? index.files.length : 0),
            csvUpdatedAt: index.csvUpdatedAt || null,
            files: Array.isArray(index.files) ? index.files : [],
            sample: (index.files || []).slice(0, 5).map((item) => item.relativePath)
        });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.get('/api/videoclip/config', (req, res) => {
    try {
        const config = readVideoClipConfig();
        const exists = fs.existsSync(config.rootPath) && fs.statSync(config.rootPath).isDirectory();
        const fileCount = exists ? fs.readdirSync(config.rootPath, { withFileTypes: true }).filter((entry) => entry.isFile()).length : 0;
        return res.json({ ok: true, rootPath: config.rootPath, exists, fileCount, updatedAt: config.updatedAt });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.post('/api/videoclip/config', (req, res) => {
    try {
        const rootPath = normalizeVideoClipPath(req.body?.rootPath);
        if (!rootPath || !fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) {
            return res.status(400).json({ ok: false, error: 'Indica una cartella VideoClip esistente e valida' });
        }
        return res.json({ ok: true, ...writeVideoClipConfig(rootPath) });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.post('/api/music-archive/match', (req, res) => {
    try {
        const brano = req.body?.brano || req.body || {};
        const forceRefresh = Boolean(req.body?.refresh);
        const index = refreshMusicArchiveIndex(forceRefresh);

        if (!index.rootPath) {
            return res.status(400).json({ ok: false, error: 'Archivio brani non configurato' });
        }

        if (!index.exists) {
            return res.status(400).json({ ok: false, error: 'Cartella archivio non raggiungibile' });
        }

        const profile = getBranoMatchProfile(brano);
        const result = resolveMusicArchiveMatch(profile, (index.files || []).map((candidate) => ({
            ...candidate,
            baseName: candidate.baseName,
            normalizedName: candidate.normalizedName,
            tokens: candidate.tokens
        })), { minScore: 160, ambiguityGap: 70 });

        const candidates = (result.candidates || []).map((entry) => ({
            fullPath: entry.fullPath,
            relativePath: entry.relativePath,
            fileName: entry.fileName,
            score: entry.score
        }));

        if (result.status === 'not_found') {
            return res.json({ ok: true, status: 'not_found', candidates: [] });
        }

        if (result.status === 'ambiguous') {
            return res.json({
                ok: true,
                status: 'ambiguous',
                candidates
            });
        }

        return res.json({
            ok: true,
            status: 'exact',
            match: candidates[0] || null,
            candidates
        });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

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

let ledDisplayData = new Uint8Array(128);

app.get(['/led-display', '/led-display/'], (req, res) => {
    res.sendFile(path.join(__dirname, 'LedDisplay', 'server', 'static', 'index.html'));
});

app.get('/led-display/get/dispdata', (req, res) => {
    res.type('application/octet-stream').send(Buffer.from(ledDisplayData));
});

app.post('/led-display/post/dispdata', express.raw({ type: 'application/octet-stream', limit: '1kb' }), (req, res) => {
    const displayData = req.body;
    if (!Buffer.isBuffer(displayData) || displayData.length === 0 || displayData.length % 2 !== 0) {
        return res.status(400).json({ message: 'Invalid display data' });
    }

    ledDisplayData = new Uint8Array(displayData);
    return res.json({ message: 'Display data updated' });
});

app.get('/led-display/set/:setting', (req, res) => {
    res.json({ message: `${req.params.setting} updated` });
});

app.use('/led-display', express.static(path.join(__dirname, 'LedDisplay', 'server', 'static')));

// Resolve the configured directory for every request so Admin changes apply immediately.
app.use('/videos', (req, res, next) => express.static(getVideoClipDir())(req, res, next));
// Serve recordings generated by USERFORM PAGINA05 for Electron secondary playback.
app.use('/userform-recordings', express.static(USERFORM_RECORDINGS_DIR));

app.get('/api/videoclip/list', (req, res) => {
    try {
        const videoClipDir = getVideoClipDir();
        if (!fs.existsSync(videoClipDir)) {
            return res.json({ dir: videoClipDir, files: [] });
        }

        const entries = fs.readdirSync(videoClipDir, { withFileTypes: true })
            .filter(entry => entry.isFile())
            .map(entry => entry.name)
            .sort((a, b) => a.localeCompare(b));

        return res.json({ dir: videoClipDir, files: entries });
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

app.post('/api/bordero/open-latest-excel', async (req, res) => {
    try {
        const excelDir = path.join(__dirname, 'Excel');
        if (!fs.existsSync(excelDir) || !fs.statSync(excelDir).isDirectory()) {
            return res.status(404).json({
                success: false,
                error: `Cartella Excel non trovata: ${excelDir}`
            });
        }

        const normalizeName = (name) => String(name || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();

        const candidates = fs.readdirSync(excelDir, { withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => {
                const normalized = normalizeName(entry.name);
                const match = normalized.match(/^bordero\s*-\s*ver\s*13\.1\.(\d{2})\.xlsm$/i);
                if (!match) return null;
                return {
                    name: entry.name,
                    version: Number(match[1])
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.version - a.version);

        if (candidates.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Nessun file Bordero - ver 13.1.xx.xlsm trovato nella cartella Excel'
            });
        }

        const latest = candidates[0];
        const targetPath = path.join(excelDir, latest.name);

        const psCommand = `
$targetPath = '${targetPath.replace(/'/g, "''")}'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
}
"@

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $true
$excel.DisplayAlerts = $false
$excel.Workbooks.Open($targetPath)

$windowHandle = $null
for ($i = 0; $i -lt 30; $i++) {
    $windowHandle = Get-Process excel -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowHandle -ne 0 } |
        Sort-Object StartTime |
        Select-Object -Last 1 -ExpandProperty MainWindowHandle

    if ($windowHandle) {
        break
    }
    Start-Sleep -Milliseconds 200
}

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
if ($windowHandle) {
    $width = [Math]::Min([int]($screen.Width * 0.95), 1800)
    $height = [Math]::Min([int]($screen.Height * 0.95), 1100)
    [void][Win32]::SetWindowPos($windowHandle, [IntPtr]::Zero, $screen.Left, $screen.Top, $width, $height, 0x0001 -bor 0x0020)
}
`;

        await execFileAsync('powershell.exe', [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-Command',
            psCommand
        ]);

        return res.json({
            success: true,
            fileName: latest.name,
            filePath: targetPath,
            version: latest.version
        });
    } catch (error) {
        console.error('Errore API /api/bordero/open-latest-excel:', error);
        return res.status(500).json({
            success: false,
            error: error?.message || String(error)
        });
    }
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

app.get('/api/userform/pagina05/cameras/probe', async (req, res) => {
    try {
        const systemCamera = await ensureSystemWebcamInUserformCsv();
        const cameras = loadUserformCameraProfiles(true);
        const physical = cameras.filter((item) => !isLikelyVirtualCameraName(item.name));

        return res.json({
            ok: true,
            source: USERFORM_CAMERA_CSV,
            count: cameras.length,
            physicalCount: physical.length,
            systemCamera,
            comparisons: Array.isArray(systemCamera?.comparisons) ? systemCamera.comparisons : [],
            cameras,
            physical
        });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error), cameras: [] });
    }
});

const handleCamerasReconcile = async (_req, res) => {
    try {
        const systemCamera = await ensureSystemWebcamInUserformCsv();
        const cameras = loadUserformCameraProfiles(true);
        const physical = cameras.filter((item) => !isLikelyVirtualCameraName(item.name));

        return res.json({
            ok: true,
            source: USERFORM_CAMERA_CSV,
            count: cameras.length,
            physicalCount: physical.length,
            systemCamera,
            comparisons: Array.isArray(systemCamera?.comparisons) ? systemCamera.comparisons : [],
            cameras,
            physical
        });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error), cameras: [] });
    }
};

app.post('/api/userform/pagina05/cameras/reconcile', handleCamerasReconcile);
app.get('/api/userform/pagina05/cameras/reconcile', handleCamerasReconcile);

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
        const now = new Date();
        const isoCompact = now.toISOString().replace(/[-:T]/g, '').replace(/\..+/, '');
        const timestamp = `${isoCompact}${String(now.getMilliseconds()).padStart(3, '0')}`;
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
        userformRecordingStartedAt = Date.now();
        setLastUserformRecordingSnapshot(plan, userformRecordingStartedAt);

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
                userformRecordingStartedAt = 0;
            }
            if (userformLastRecordingSnapshot?.plan?.targetFilePath === plan.targetFilePath) {
                userformLastRecordingSnapshot.stoppedAt = Date.now();
            }
        });

        return res.json({
            ok: true,
            recording: true,
            pid: child.pid,
            startedAt: userformRecordingStartedAt,
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

app.get('/api/userform/pagina05/electron/page-policy', async (_req, res) => {
    try {
        const result = await callElectronControl('/page-policy');
        return res.json({ ok: true, policy: Array.isArray(result.policy) ? result.policy : [] });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.post('/api/userform/pagina05/electron/page-policy', async (req, res) => {
    try {
        const pagePath = sanitizeCsvValue(req.body?.path);
        const primary = req.body?.primary !== undefined ? Boolean(req.body.primary) : undefined;
        const secondary = req.body?.secondary !== undefined ? Boolean(req.body.secondary) : undefined;

        if (!pagePath) {
            return res.status(400).json({ ok: false, error: 'path obbligatorio' });
        }

        const result = await callElectronControl('/page-policy', { path: pagePath, primary, secondary });
        return res.json({ ok: true, policy: result.policy });
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
        const order = String(req.body?.order || 'alfabetico').trim().toLowerCase();
        const includeDuration = req.body?.includeDuration === true;
        const completed = brani
            .filter(item => String(item?.flag || '').trim().toUpperCase() === 'X')
            .map(item => {
                const titolo = String(item?.brano || item?.song || item?.titolo || '').replace(/"/g, '').trim();
                const autore = String(item?.autore || '').replace(/"/g, '').trim();
                const durata = String(item?.durata || item?.duration || '').replace(/"/g, '').trim();
                const timestamp = item?.timestamp ? new Date(item.timestamp).getTime() : Number.NaN;
                return { titolo, autore, durata, timestamp, originalIndex: Number(item?.originalIndex) || 0 };
            })
            .filter(item => item.titolo || item.autore);

        if (completed.length === 0) {
            return res.status(400).json({ error: 'Nessun record valido da esportare.' });
        }

        if (order === 'cronologico' || order === 'chronological') {
            completed.sort((left, right) => {
                const leftTime = Number.isNaN(left.timestamp) ? Number.POSITIVE_INFINITY : left.timestamp;
                const rightTime = Number.isNaN(right.timestamp) ? Number.POSITIVE_INFINITY : right.timestamp;
                return leftTime - rightTime || left.originalIndex - right.originalIndex;
            });
        } else {
            completed.sort((left, right) => left.titolo.localeCompare(right.titolo, 'it', { sensitivity: 'base' }));
        }

        const rows = completed.map(item => [item.titolo, item.autore, '', '', includeDuration ? item.durata : ''].map(formatSiaeField).join(','));
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

router.get('/event-meta', (req, res) => {
    try {
        res.json(readEventMeta());
    } catch (e) {
        res.status(500).json({ error: 'Impossibile leggere metadati evento' });
    }
});

router.post('/event-meta', (req, res) => {
    try {
        const saved = writeEventMeta(req.body?.eventName);
        res.json({ ok: true, ...saved });
        broadcastEventiUpdate({ type: 'event-meta-updated', eventName: saved.eventName });
    } catch (e) {
        res.status(500).json({ error: 'Errore salvataggio metadati evento' });
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
        fs.writeFileSync(pathEventMeta, JSON.stringify({ eventName: '', updatedAt: new Date().toISOString() }, null, 2));

        res.json({
            ok: true,
            cleared: Array.isArray(log) ? log.length : 0,
            message: 'Date e orari delle coreografie sono stati resettati. Il nuovo evento puo iniziare con cronologia pulita. Anche il nome evento e stato azzerato.'
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

function parseCsvLine(line, delimiter = ',') {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const next = line[i + 1];

        if (ch === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === delimiter && !inQuotes) {
            cells.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }

    cells.push(current.trim());
    return cells;
}

function normalizeLogState(state) {
    if (state === true || state === 1) return 'eseguito';
    if (state === false || state === 0) return 'disponibile';

    const normalized = String(state || '').trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'eseguito') return 'eseguito';
    if (normalized === '2' || normalized === 'prenotato') return 'prenotato';
    if (normalized === '0' || normalized === 'false' || normalized === 'disponibile') return 'disponibile';

    return normalized;
}

// Funzione per ottenere i dettagli di un brano dall'archivio
function getBraniDetails(id, braniJson, extraCsvPath) {
    // Cerca prima nei brani normali
    const brano = braniJson.find(b => b.id === id);
    if (brano) {
        return {
            titolo: brano.brano || brano.titolo || '',
            autore: brano.autore || '',
            compositore: brano.compositore || '',
            performer: '',
            durata: brano.durata || ''
        };
    }
    
    // Cerca nelle coreografie aggiuntive
    if (fs.existsSync(extraCsvPath)) {
        const extraContent = fs.readFileSync(extraCsvPath, 'utf-8');
        const extraLines = extraContent.replace(/\r/g, '').split('\n').filter(line => line.trim());
        const delimiter = detectCsvDelimiter(extraLines[0] || extraLines[1] || '');

        for (let idx = 1; idx < extraLines.length; idx += 1) {
            const cols = parseCsvLine(extraLines[idx], delimiter);
            if (cols.length >= 8 && String(cols[2] || '').trim() === String(id)) {
                return {
                    titolo: cols[4] || '', // brano (colonna 5)
                    autore: cols[6] || '', // autore (colonna 7)
                    compositore: cols[5] || '', // compositore (colonna 6)
                    performer: '',
                    durata: cols[7] || '' // durata (colonna 8)
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
            if (normalizeLogState(entry.stato) === 'eseguito') {
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
                records.push({ ...details, _timestamp: entry.timestamp || '' });
            } else {
                // Brano non trovato, inserisci con ID come titolo
                records.push({
                    titolo: entry.id,
                    autore: '',
                    compositore: '',
                    performer: '',
                    durata: '',
                    _timestamp: entry.timestamp || ''
                });
            }
        }

        const order = String(req.query.order || '').toLowerCase();
        if (order === 'alfabetico' || order === 'alphabetical') {
            records.sort((a, b) => {
                const normA = normalizeForSort(a.titolo);
                const normB = normalizeForSort(b.titolo);
                return normA.localeCompare(normB, 'it');
            });
        } else {
            records.sort((a, b) => {
                const ta = new Date(a._timestamp || 0).getTime();
                const tb = new Date(b._timestamp || 0).getTime();
                return ta - tb;
            });
        }
        
        // Costruisci il CSV in formato SIAE
        const siaeHeader = 'Titolo,Autore,Compositore,Performer,Durata';
        const includeDuration = String(req.query.duration || '').toLowerCase() === '1';
        const siaeRows = records.map(r => {
            return [
                formatSiaeField(r.titolo),
                formatSiaeField(r.autore),
                formatSiaeField(r.compositore),
                formatSiaeField(r.performer),
                includeDuration ? formatSiaeField(r.durata) : ''
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
function handleBorderoDjSourceSave(req, res) {
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
}

router.post('/bordero/dj-source', handleBorderoDjSourceSave);
app.post('/api/bordero/dj-source', handleBorderoDjSourceSave);

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
refreshMusicArchiveIndex(true);
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

            ensureSystemWebcamInUserformCsv()
                .then((result) => {
                    const added = Number(result?.addedCount || 0);
                    const updated = Number(result?.updatedCount || 0);
                    const devices = Array.isArray(result?.physicalCandidates) ? result.physicalCandidates.length : 0;
                    console.log(`[WEBCAM] Profilazione avvio completata: ${devices} webcam fisiche, +${added} nuove, ${updated} aggiornate.`);
                })
                .catch((error) => {
                    console.warn(`[WEBCAM] Profilazione avvio fallita: ${error?.message || error}`);
                });

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
