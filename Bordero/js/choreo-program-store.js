/* Programmi annuali delle coreografie, separati dal catalogo brani. */
(function () {
  'use strict';
  const STORAGE_KEY = (typeof BORDERO_CONFIG !== 'undefined' && BORDERO_CONFIG.CACHE_KEY_CHOREO_PROGRAMS) || 'bordero_choreoPrograms';
  const DATABASE_PATH = 'bordero/dance_curriculum';
  const REST_URL = `${(typeof BORDERO_CONFIG !== 'undefined' && BORDERO_CONFIG.FIREBASE_REALTIME_DB_URL) || 'https://my-project-1525790600392-default-rtdb.europe-west1.firebasedatabase.app'}/${DATABASE_PATH}.json`;
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function normalizeState(value) {
    const state = { version: 1, activeSeason: '', seasons: {}, updatedAt: '' };
    if (!value || typeof value !== 'object') return state;
    state.activeSeason = String(value.activeSeason || '');
    state.updatedAt = String(value.updatedAt || '');
    for (const [id, season] of Object.entries(value.seasons || {})) {
      if (!/^\d{4}-\d{4}$/.test(id) || !season || typeof season !== 'object') continue;
      // RTDB omette gli array vuoti e può restituire gli array sparsi come oggetti.
      const records = Array.isArray(season.records) ? season.records : Object.values(season.records || {});
      state.seasons[id] = { ...season, id, records: records.filter((record) => record && typeof record === 'object') };
    }
    return state;
  }

  class ChoreoProgramStore {
    constructor() {
      this.pendingSeasons = {};
      this.pendingActive = '';
      this.state = this.readCache();
      this.pollTimer = null;
      this.loading = null;
      this.lastLoadAt = 0;
      this.revision = 0;
      this.writeQueue = Promise.resolve();
      window.addEventListener('storage', (event) => {
        if (event.key !== STORAGE_KEY) return;
        this.state = this.readCache();
        this.revision += 1;
        this.emit('local');
      });
      window.addEventListener('pagehide', () => this.stopPolling());
    }

    readCache() {
      try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        this.pendingSeasons = value?._pendingSeasons || {};
        this.pendingActive = value?._pendingActive || '';
        return normalizeState(value);
      } catch (error) {
        console.warn('[ChoreoProgramStore] Cache locale non leggibile:', error?.message || error);
        return normalizeState(null);
      }
    }

    writeCache(source = 'local') {
      this.revision += 1;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          ...this.state, _pendingSeasons: this.pendingSeasons, _pendingActive: this.pendingActive
        }));
      } catch (error) {
        console.warn('[ChoreoProgramStore] Cache locale non disponibile:', error?.message || error);
      }
      this.emit(source);
    }

    emit(source) {
      window.dispatchEvent(new CustomEvent('bordero:choreo-program-updated', {
        detail: { state: this.getState(), source }
      }));
    }

    getState() { return clone(this.state); }

    load(options = {}) {
      if (this.loading) return this.loading;
      if (!options.force && Date.now() - this.lastLoadAt < 15000) return Promise.resolve(this.getState());
      this.loading = this.loadRemote().finally(() => { this.loading = null; });
      return this.loading;
    }

    async loadRemote() {
      const revision = this.revision;
      try {
        const response = await fetch(`${REST_URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const remote = normalizeState(await response.json());
        // Una risposta iniziata prima di un salvataggio può contenere dati superati.
        if (revision !== this.revision) return this.getState();
        // Gli aggiornamenti ricevuti non devono cancellare le modifiche offline.
        for (const id of Object.keys(this.pendingSeasons)) {
          if (this.state.seasons[id]) remote.seasons[id] = this.state.seasons[id];
          else delete remote.seasons[id];
        }
        if (this.pendingActive) remote.activeSeason = this.state.activeSeason;
        if (this.pendingActive || Object.keys(this.pendingSeasons).length) remote.updatedAt = this.state.updatedAt;
        const changed = JSON.stringify(remote) !== JSON.stringify(this.state);
        this.state = remote;
        this.lastLoadAt = Date.now();
        if (changed) this.writeCache('remote');
      } catch (error) {
        console.warn('[ChoreoProgramStore] Lettura cloud non disponibile, uso cache locale:', error?.message || error);
      }
      return this.getState();
    }

    startPolling(callback, intervalMs = 45000) {
      this.stopPolling();
      this.pollTimer = window.setInterval(async () => {
        const previous = JSON.stringify(this.state);
        await this.load({ force: true });
        if (JSON.stringify(this.state) !== previous && typeof callback === 'function') callback(this.getState());
      }, intervalMs);
    }

    stopPolling() {
      if (this.pollTimer) window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    enqueueWrite(action) {
      const next = this.writeQueue.then(action);
      this.writeQueue = next.catch(() => {});
      return next;
    }

    async publisherDatabase() {
      const client = window.firebaseCloudClient;
      await client?.authReady;
      const user = client?.publisherAuth?.currentUser;
      if (!client?.publisherDatabase || !user || !client.isAuthorizedPublisher(user)) {
        throw new Error('Accedi con un account Google autorizzato per sincronizzare il programma.');
      }
      return client.publisherDatabase;
    }

    async flushPending() {
      const database = await this.publisherDatabase();
      const pending = { ...this.pendingSeasons };
      const activeToken = this.pendingActive;
      const updates = {};
      for (const id of Object.keys(pending)) updates[`seasons/${id}`] = this.state.seasons[id] || null;
      if (activeToken) updates.activeSeason = this.state.activeSeason;
      if (!activeToken && !Object.keys(pending).length) return;
      updates.updatedAt = new Date().toISOString();
      updates.version = 1;
      await database.ref(DATABASE_PATH).update(clone(updates));
      // Un salvataggio arrivato mentre la richiesta era in corso resta in attesa.
      for (const [id, token] of Object.entries(pending)) {
        if (this.pendingSeasons[id] === token) delete this.pendingSeasons[id];
      }
      if (this.pendingActive === activeToken) this.pendingActive = '';
      this.writeCache();
    }

    newToken() { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

    async saveSeason(season) {
      if (!/^\d{4}-\d{4}$/.test(season?.id || '')) throw new Error('Anno accademico non valido.');
      const normalized = clone({ ...season, updatedAt: new Date().toISOString(), records: Array.isArray(season.records) ? season.records : [] });
      this.state.seasons[normalized.id] = normalized;
      this.state.updatedAt = normalized.updatedAt;
      this.pendingSeasons[normalized.id] = this.newToken();
      this.writeCache();
      try {
        await this.enqueueWrite(() => this.flushPending());
        return { synced: true, season: clone(normalized) };
      } catch (error) {
        return { synced: false, error, season: clone(normalized) };
      }
    }

    async setActiveSeason(seasonId) {
      if (seasonId && !this.state.seasons[seasonId]) throw new Error('La stagione selezionata non esiste.');
      this.state.activeSeason = seasonId || '';
      this.state.updatedAt = new Date().toISOString();
      this.pendingActive = this.newToken();
      this.writeCache();
      try {
        // Pubblica anche la stagione in attesa prima di renderla attiva.
        await this.enqueueWrite(() => this.flushPending());
        return { synced: true };
      } catch (error) {
        return { synced: false, error };
      }
    }

    async removeSeason(seasonId) {
      await this.publisherDatabase();
      delete this.state.seasons[seasonId];
      this.pendingSeasons[seasonId] = this.newToken();
      if (this.state.activeSeason === seasonId) {
        this.state.activeSeason = '';
        this.pendingActive = this.newToken();
      }
      this.state.updatedAt = new Date().toISOString();
      this.writeCache();
      await this.enqueueWrite(() => this.flushPending());
    }

    async syncAll() {
      // Invia solo le modifiche locali: gli archivi letti da altri PC restano intatti.
      await this.enqueueWrite(() => this.flushPending());
      await this.load({ force: true });
      return true;
    }
  }

  window.choreoProgramStore = window.choreoProgramStore || new ChoreoProgramStore();
})();
