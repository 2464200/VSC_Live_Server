/**
 * BORDERO - Firebase Cloud Sync Server Module
 * Sincronizza lo stato in tempo reale della serata e del display su Firebase Realtime Database
 * Non introduce dipendenze esterne: usa https nativo di Node.js.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

class FirebaseCloudSync {
  constructor(options = {}) {
    this.enabled = process.env.FIREBASE_CLOUD_SYNC_ENABLED !== 'false';
    this.databaseUrl = process.env.FIREBASE_DATABASE_URL || 'https://my-project-1525790600392-default-rtdb.europe-west1.firebasedatabase.app';
    this.databaseSecret = process.env.FIREBASE_DATABASE_SECRET || process.env.FIREBASE_AUTH_TOKEN || '';
    this.syncPath = '/bordero/display_state.json';
    this.lastSyncTime = null;
    this.lastSyncStatus = 'initialized';
    this.lastError = null;
    this.syncDebounceTimer = null;
    this.fileWatchers = [];
    this.lastKnownState = {
      updatedAt: null,
      nextCoreo: '--',
      serata: {
        dj: '',
        data: '',
        luogo: '',
        evento: '',
        completed: '0/0'
      },
      brani: [],
      source: 'local-server'
    };

    this.initWatchers();
    if (this.enabled) {
      setImmediate(() => this.syncFromLocalFiles());
    }
  }

  getDbUrl() {
    let urlStr = this.databaseUrl.replace(/\/+$/, '') + this.syncPath;
    if (this.databaseSecret) {
      urlStr += `?auth=${encodeURIComponent(this.databaseSecret)}`;
    }
    return urlStr;
  }

  /**
   * Invia payload a Firebase Realtime Database tramite HTTP PUT
   */
  async pushState(payload = {}) {
    if (!this.enabled) {
      return { success: false, reason: 'Firebase Cloud Sync disabilitato' };
    }

    const mergedPayload = {
      ...this.lastKnownState,
      ...payload,
      updatedAt: new Date().toISOString(),
      source: 'vsc-live-server'
    };

    this.lastKnownState = mergedPayload;

    return new Promise((resolve) => {
      try {
        const fullUrl = new URL(this.getDbUrl());
        const postData = JSON.stringify(mergedPayload);
        const isHttps = fullUrl.protocol === 'https:';
        const client = isHttps ? https : http;

        const reqOptions = {
          protocol: fullUrl.protocol,
          hostname: fullUrl.hostname,
          port: fullUrl.port || (isHttps ? 443 : 80),
          path: fullUrl.pathname + fullUrl.search,
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 8000
        };

        const req = client.request(reqOptions, (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              this.lastSyncTime = new Date().toISOString();
              this.lastSyncStatus = 'ok';
              this.lastError = null;
              resolve({ success: true, timestamp: this.lastSyncTime });
            } else {
              const errMsg = `HTTP ${res.statusCode}: ${body}`;
              this.lastSyncStatus = 'error';
              this.lastError = errMsg;
              resolve({ success: false, error: errMsg, statusCode: res.statusCode });
            }
          });
        });

        req.on('timeout', () => {
          req.destroy();
          const errMsg = 'Timeout connessione Firebase';
          this.lastSyncStatus = 'timeout';
          this.lastError = errMsg;
          resolve({ success: false, error: errMsg });
        });

        req.on('error', (err) => {
          const errMsg = err?.message || String(err);
          this.lastSyncStatus = 'error';
          this.lastError = errMsg;
          resolve({ success: false, error: errMsg });
        });

        req.write(postData);
        req.end();
      } catch (err) {
        const errMsg = err?.message || String(err);
        this.lastSyncStatus = 'error';
        this.lastError = errMsg;
        resolve({ success: false, error: errMsg });
      }
    });
  }

  /**
   * Debounced sync da modifiche file locali
   */
  scheduleSyncFromFiles() {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    this.syncDebounceTimer = setTimeout(() => {
      this.syncFromLocalFiles();
    }, 400);
  }

  /**
   * Legge NextCoreo.csv e brani.csv locali e invia a Firebase
   */
  async syncFromLocalFiles() {
    try {
      const repoRoot = path.join(__dirname, '..', '..');
      const nextCoreoFile = path.join(repoRoot, 'NextCoreo.csv');
      const braniFile = path.join(__dirname, '..', 'data', 'brani.csv');

      let nextCoreoVal = this.lastKnownState.nextCoreo || '--';
      if (fs.existsSync(nextCoreoFile)) {
        try {
          const content = fs.readFileSync(nextCoreoFile, 'utf8').replace(/^\uFEFF/, '').trim();
          const firstLine = content.split(/\r?\n/)[0] || '';
          const cols = firstLine.split(',').map(c => c.replace(/^"|"$/g, '').trim());
          nextCoreoVal = cols[1] || cols[0] || nextCoreoVal;
        } catch (_) {}
      }

      let braniList = this.lastKnownState.brani || [];
      if (fs.existsSync(braniFile)) {
        try {
          const raw = fs.readFileSync(braniFile, 'utf8').replace(/^\uFEFF/, '').trim();
          const lines = raw.split(/\r?\n/).slice(3); // skip first 3 lines standard
          braniList = lines
            .map((line) => {
              const parts = line.split(',').map(s => s.replace(/^"|"$/g, '').trim());
              return {
                flag: parts[0] || '',
                id: parts[1] || '',
                titolo: parts[2] || '',
                brano: parts[3] || '',
                autore: parts[4] || '',
                richieste: parts[6] || parts[5] || '',
                info_livello: parts[7] || ''
              };
            })
            .filter(b => Boolean(b.titolo));
        } catch (_) {}
      }

      await this.pushState({
        nextCoreo: nextCoreoVal,
        brani: braniList.length > 0 ? braniList : this.lastKnownState.brani
      });
    } catch (err) {
      console.warn('⚠️ [FirebaseCloudSync] syncFromLocalFiles errore:', err?.message || err);
    }
  }

  initWatchers() {
    const repoRoot = path.join(__dirname, '..', '..');
    const watchTargets = [
      path.join(repoRoot, 'NextCoreo.csv'),
      path.join(__dirname, '..', 'data', 'brani.csv'),
      path.join(repoRoot, 'display.csv')
    ];

    watchTargets.forEach((targetPath) => {
      try {
        if (fs.existsSync(targetPath)) {
          const watcher = fs.watch(targetPath, () => {
            this.scheduleSyncFromFiles();
          });
          if (typeof watcher.unref === 'function') {
            watcher.unref();
          }
          this.fileWatchers.push(watcher);
        }
      } catch (_) {}
    });
  }

  getStatus() {
    return {
      enabled: this.enabled,
      databaseUrl: this.databaseUrl,
      syncPath: this.syncPath,
      lastSyncTime: this.lastSyncTime,
      lastSyncStatus: this.lastSyncStatus,
      lastError: this.lastError,
      lastKnownState: {
        updatedAt: this.lastKnownState.updatedAt,
        nextCoreo: this.lastKnownState.nextCoreo,
        serata: this.lastKnownState.serata,
        braniCount: (this.lastKnownState.brani || []).length
      }
    };
  }
}

const firebaseCloudSync = new FirebaseCloudSync();

module.exports = {
  firebaseCloudSync,
  FirebaseCloudSync
};
