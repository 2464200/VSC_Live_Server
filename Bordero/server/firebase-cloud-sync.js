/**
 * BORDERO - Firebase Cloud Sync Server Module
 * Sincronizza lo stato in tempo reale della serata e del display su Firebase Realtime Database
 * Non introduce dipendenze esterne: usa https nativo di Node.js.
 */

const fs = require('fs');
const path = require('path');
const { parse: parseCsv } = require('csv-parse/sync');

class FirebaseCloudSync {
  constructor(options = {}) {
    this.enabled = process.env.FIREBASE_CLOUD_SYNC_ENABLED !== 'false';
    this.databaseUrl = process.env.FIREBASE_DATABASE_URL || 'https://my-project-1525790600392-default-rtdb.europe-west1.firebasedatabase.app';
    this.authenticationMode = 'google-auth-client';
    this.syncPath = '/bordero/display_state.json';
    this.lastSyncTime = null;
    this.lastSyncStatus = 'client-auth-required';
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
      catalogBrani: [],
      source: 'local-server'
    };

    this.initWatchers();
    if (this.enabled) {
      setImmediate(() => this.initializeFromCloudAndSync());
    }
  }

  /**
   * Ripristina lo stato già pubblicato prima di aggiornare i dati derivati dai CSV.
   * Più istanze del server possono avviarsi su porte diverse: senza questo passaggio
   * ciascuna partirebbe con metadata vuoti/obsoleti e potrebbe sovrascrivere la serata
   * attualmente visibile sul display.
   */
  async initializeFromCloudAndSync() {
    await this.syncFromLocalFiles();
  }

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
    this.lastSyncStatus = 'client-auth-required';
    this.lastError = 'La pubblicazione cloud richiede un utente Google autorizzato nella pagina Borderò.';
    return { success: false, reason: this.lastError };
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
          nextCoreoVal = cols[1] || cols[0] || '--';
        } catch (_) {}
      }

      let braniList = this.lastKnownState.catalogBrani || [];
      if (fs.existsSync(braniFile)) {
        try {
          const raw = fs.readFileSync(braniFile, 'utf8').replace(/^\uFEFF/, '').trim();
          const rows = parseCsv(raw, {
            from_line: 4,
            relax_column_count: true,
            skip_empty_lines: true,
            trim: true
          });
          braniList = rows
            .map((parts) => {
              return {
                flag: parts[0] || '',
                id: parts[2] || '',
                titolo: parts[3] || '',
                brano: parts[4] || '',
                autore: parts[5] || '',
                durata: parts[6] || '',
                richieste: parts[7] || '',
                info_livello: parts[8] || '',
                coreografo: parts[12] || ''
              };
            })
            .filter(b => Boolean(b.titolo));
        } catch (_) {}
      }

      return await this.pushState({
        nextCoreo: nextCoreoVal,
        catalogBrani: braniList.length > 0 ? braniList : this.lastKnownState.catalogBrani
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
      enabled: false,
      databaseUrl: this.databaseUrl,
      authenticationMode: this.authenticationMode,
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
