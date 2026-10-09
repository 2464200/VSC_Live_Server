/**
 * BORDERO - Firebase Realtime Cloud Client
 * Gestisce la sincronizzazione cloud bidirezionale:
 * - Su Web/Firebase Hosting: riceve gli aggiornamenti live (SSE / Polling) in tempo reale senza ricaricare la pagina.
 * - In Locale (VS Code / PC): pubblica lo stato con Google Auth e regole RTDB.
 */

(function () {
  'use strict';

  const MAX_CLOUD_STATE_AGE_MS = 48 * 60 * 60 * 1000;
  const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;
  const FIREBASE_CONFIG_CACHE_MAX_AGE_MS = 60 * 60 * 1000;
  const ALLOWED_PUBLISHER_EMAILS = new Set([
    'lucafaby@gmail.com',
    'djdaniele1984@gmail.com'
  ]);

  class FirebaseCloudClient {
    constructor() {
      this.dbUrl = (typeof BORDERO_CONFIG !== 'undefined' && BORDERO_CONFIG?.FIREBASE_REALTIME_DB_URL)
        || 'https://my-project-1525790600392-default-rtdb.europe-west1.firebasedatabase.app';
      this.syncPath = '/bordero/display_state.json';
      this.isCloudHost = this.detectCloudHost();
      this.isPublisherPage = this.detectPublisherPage();
      this.isAdminPage = this.detectAdminPage();
      this.eventSource = null;
      this.pollingTimer = null;
      this.lastStateTimestamp = null;
      this.latestCloudState = null;
      this.hasFreshCloudState = false;
      this.latestNextCoreo = '--';
      this.isConnected = false;
      this.localPushDebounceTimer = null;
      this.publisherAuth = null;
      this.publisherDatabase = null;
      this.authReady = Promise.resolve();

      this.init();
    }

    detectCloudHost() {
      if (typeof window === 'undefined' || !window.location) return false;
      const host = window.location.hostname.toLowerCase();
      const search = window.location.search.toLowerCase();
      const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(host);
      return (
        host.includes('web.app') ||
        host.includes('firebaseapp.com') ||
        host.includes('github.io') ||
        search.includes('cloud=1') ||
        search.includes('cloudsync=1') ||
        (!isLocalHost && window.location.port !== '5500')
      );
    }

    detectPublisherPage() {
      if (typeof window === 'undefined' || !window.location) return false;
      return /\/pages\/(?:bordero|admin|dj-preselezione)\.html$/i.test(window.location.pathname);
    }

    detectAdminPage() {
      if (typeof window === 'undefined' || !window.location) return false;
      return /\/pages\/admin\.html$/i.test(window.location.pathname);
    }

    init() {
      if (this.isCloudHost) {
        console.log('[FirebaseCloudClient] Modalità Cloud attiva (Host:', window.location.hostname, ')');
        this.startCloudListener();
      } else if (this.isPublisherPage) {
        console.log('[FirebaseCloudClient] Modalità publisher locale: autenticazione Google richiesta.');
        this.initializePublisherAuth();
        this.setupLocalSyncTriggers();
      }
      this.injectStatusIndicator();
    }

    async initializePublisherAuth() {
      try {
        if (!window.firebase?.initializeApp || !window.firebase?.auth || !window.firebase?.database) {
          throw new Error('Firebase Auth SDK non caricato.');
        }

        const projectId = BORDERO_CONFIG.FIREBASE_PROJECT_ID;
        const firebaseConfig = await this.loadFirebaseConfig(projectId);
        firebaseConfig.databaseURL = firebaseConfig.databaseURL || this.dbUrl;

        const app = window.firebase.apps.length
          ? window.firebase.app()
          : window.firebase.initializeApp(firebaseConfig);
        this.publisherAuth = app.auth();
        this.publisherDatabase = app.database();

        this.authReady = new Promise((resolve) => {
          let resolved = false;
          const markReady = () => {
            if (resolved) return;
            resolved = true;
            resolve();
          };

          this.publisherAuth.onAuthStateChanged((user) => {
            this.updatePublisherControls(user);
            markReady();

            if (user && this.isAuthorizedPublisher(user)) {
              this.fetchCloudStateDirect();
            } else if (user) {
              this.updateStatusBadge(false, '🔒 Account non autorizzato');
            } else {
              this.updateStatusBadge(false, '🔒 Accedi per sincronizzare');
            }
          }, (error) => {
            markReady();
            console.error('[FirebaseCloudClient] Errore stato autenticazione:', error);
            this.updateStatusBadge(false, '⚠️ Errore autenticazione');
          });
        });
      } catch (error) {
        this.authReady = Promise.resolve();
        console.error('[FirebaseCloudClient] Inizializzazione Auth fallita:', error);
        this.updateStatusBadge(false, '⚠️ Auth non disponibile');
      }
    }

    async loadFirebaseConfig(projectId) {
      const cacheKey = `bordero-firebase-web-config:${projectId}`;
      try {
        const cachedValue = sessionStorage.getItem(cacheKey);
        if (cachedValue) {
          const cached = JSON.parse(cachedValue);
          const age = Date.now() - cached.cachedAt;
          if (
            cached.config?.projectId === projectId
            && Number.isFinite(age)
            && age >= 0
            && age < FIREBASE_CONFIG_CACHE_MAX_AGE_MS
          ) {
            return { ...cached.config };
          }
          sessionStorage.removeItem(cacheKey);
        }
      } catch (error) {
        console.warn('[FirebaseCloudClient] Cache configurazione Firebase non leggibile:', error);
      }

      const response = await fetch(BORDERO_CONFIG.FIREBASE_WEB_CONFIG_URL, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Configurazione Firebase non disponibile (HTTP ${response.status}).`);
      }

      const firebaseConfig = await response.json();
      if (firebaseConfig.projectId !== projectId) {
        throw new Error('La configurazione web Firebase non corrisponde al progetto Borderò.');
      }

      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({
          config: firebaseConfig,
          cachedAt: Date.now()
        }));
      } catch (error) {
        console.warn('[FirebaseCloudClient] Cache configurazione Firebase non disponibile:', error);
      }
      return firebaseConfig;
    }

    isAuthorizedPublisher(user) {
      return Boolean(user?.email && ALLOWED_PUBLISHER_EMAILS.has(user.email.toLowerCase()));
    }

    async togglePublisherAuth() {
      try {
        if (!this.publisherAuth) {
          throw new Error('Firebase Auth non è inizializzato.');
        }
        if (this.publisherAuth.currentUser) {
          await this.publisherAuth.signOut();
        }

        const provider = new window.firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await this.publisherAuth.signInWithPopup(provider);
      } catch (error) {
        console.error('[FirebaseCloudClient] Accesso Google non riuscito:', error);
        this.updateStatusBadge(false, '⚠️ Accesso Google non riuscito');
      }
    }

    updatePublisherControls(user = this.publisherAuth?.currentUser) {
      const authButton = document.getElementById('firebase-cloud-auth');
      const publishButton = document.getElementById('firebase-cloud-publish');
      if (authButton) {
        authButton.textContent = user ? `Cambia account (${user.email || 'Google'})` : 'Accedi con Google';
        authButton.title = user
          ? `Account attivo: ${user.email || 'Google'}. Clicca per sceglierne un altro.`
          : 'Scegli il profilo Google per pubblicare lo stato live';
      }
      if (publishButton) {
        publishButton.hidden = !user || !this.isAuthorizedPublisher(user);
      }
    }

    getDbEndpoint() {
      return this.dbUrl.replace(/\/+$/, '') + this.syncPath;
    }

    /**
     * Sottoscrizione Server-Sent Events (SSE) a Firebase Realtime Database
     */
    startCloudListener() {
      const endpoint = this.getDbEndpoint();

      // Prova prima con EventSource (standard SSE Firebase Realtime Database)
      if (typeof EventSource !== 'undefined') {
        try {
          this.eventSource = new EventSource(endpoint);

          this.eventSource.addEventListener('put', (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data && typeof data === 'object') {
                const payload = data.path === '/' ? data.data : data;
                this.handleCloudState(payload);
              }
            } catch (err) {
              console.warn('[FirebaseCloudClient] Errore parsing SSE put:', err);
            }
          });

          this.eventSource.addEventListener('patch', (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data && typeof data === 'object') {
                const payload = data.path === '/' ? data.data : data;
                this.handleCloudState(payload);
              }
            } catch (err) {
              console.warn('[FirebaseCloudClient] Errore parsing SSE patch:', err);
            }
          });

          this.eventSource.onopen = () => {
            this.isConnected = true;
            this.updateStatusBadge(true, '🟢 Cloud Live');
          };

          this.eventSource.onerror = () => {
            this.isConnected = false;
            this.updateStatusBadge(false, '🟡 Riconnessione Cloud...');
            // Fallback a polling continuo se EventSource fallisce
            this.ensurePollingFallback();
          };
        } catch (err) {
          console.warn('[FirebaseCloudClient] EventSource non disponibile, uso polling:', err);
          this.ensurePollingFallback();
        }
      } else {
        this.ensurePollingFallback();
      }

      // Fetch iniziale immediata
      this.fetchCloudStateDirect();
    }

    ensurePollingFallback() {
      if (this.pollingTimer) return;
      this.pollingTimer = setInterval(() => {
        this.fetchCloudStateDirect();
      }, 2500);
    }

    async fetchCloudStateDirect() {
      try {
        const endpoint = `${this.getDbEndpoint()}?t=${Date.now()}`;
        const res = await fetch(endpoint, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            this.isConnected = true;
            this.updateStatusBadge(true, '🟢 Cloud Live');
            this.handleCloudState(data);
            return data;
          } else {
            this.clearMissingCloudState();
            return null;
          }
        } else if (res.status === 404) {
          this.clearMissingCloudState();
          return null;
        } else {
          this.isConnected = false;
          this.updateStatusBadge(false, '🟡 Cloud Inattivo');
        }
      } catch (err) {
        this.isConnected = false;
        this.updateStatusBadge(false, '⚪ Offline');
        console.warn('[FirebaseCloudClient] Lettura stato cloud non riuscita:', err);
      }
      return undefined;
    }

    clearMissingCloudState() {
      this.hasFreshCloudState = false;
      this.latestNextCoreo = '--';
      this.latestCloudState = null;

      if (this.isCloudHost && typeof Storage !== 'undefined' && typeof BORDERO_CONFIG !== 'undefined') {
        Storage.remove(BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA);
      }

      const nextCoreoEl = document.getElementById('next-coreo');
      if (nextCoreoEl) nextCoreoEl.textContent = '--';
      if (window.displayMonitor?.refresh) window.displayMonitor.refresh();
      if (window.nextCoreoDisplay?.refresh) window.nextCoreoDisplay.refresh();
      this.updateStatusBadge(true, '🟡 Nessuno stato Cloud');
    }

    /**
     * Applica lo stato cloud al DOM e allo storage locale
     */
    handleCloudState(payload) {
      if (!payload || typeof payload !== 'object') return;

      const { nextCoreo, serata, brani, catalogBrani, updatedAt } = payload;
      this.latestCloudState = payload;
      const timestamp = Date.parse(updatedAt || '');
      const stateKey = Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : 'missing-timestamp';

      if (stateKey === this.lastStateTimestamp) {
        return; // Nessuna variazione
      }
      this.lastStateTimestamp = stateKey;

      const ageMs = Date.now() - timestamp;
      if (!Number.isFinite(timestamp) || ageMs > MAX_CLOUD_STATE_AGE_MS || ageMs < -MAX_FUTURE_CLOCK_SKEW_MS) {
        this.hasFreshCloudState = false;
        this.clearExpiredStoredSerata();
        this.updateStatusBadge(false, 'Cloud non aggiornato · uso dati pubblicati');
        return;
      }

      this.hasFreshCloudState = true;
      this.latestNextCoreo = String(nextCoreo || '--').trim() || '--';

      // 1. Aggiorna Prossima Coreo
      if (nextCoreo) {
        const nextCoreoEl = document.getElementById('next-coreo');
        if (nextCoreoEl) {
          nextCoreoEl.textContent = nextCoreo;
        }
      }

      // 2. Aggiorna Serata & Brani
      if (typeof Storage !== 'undefined' && Storage.set) {
        const storedSerata = typeof dataLoader !== 'undefined' && typeof dataLoader.getCurrentSerata === 'function'
          ? dataLoader.getCurrentSerata()
          : null;
        const localSavedAt = Date.parse(storedSerata?.savedAt || '');
        const cloudSnapshotIsOlder = Number.isFinite(localSavedAt) && localSavedAt > timestamp;
        const incomingBrani = cloudSnapshotIsOlder && Array.isArray(storedSerata?.brani)
          ? storedSerata.brani
          : (Array.isArray(brani) ? brani : (storedSerata?.brani || []));
        const mergedBrani = typeof dataLoader !== 'undefined'
          && typeof dataLoader.mergeMissingExecutedBrani === 'function'
          ? dataLoader.mergeMissingExecutedBrani(incomingBrani, storedSerata?.brani, {
            preserveConflictingExecution: cloudSnapshotIsOlder
          })
          : incomingBrani;

        if (Array.isArray(catalogBrani)) {
          Storage.set(BORDERO_CONFIG.CACHE_KEY_BRANI, catalogBrani);
          Storage.set('BORDERO_BRANI_DATA', catalogBrani);
          if (typeof dataLoader !== 'undefined') dataLoader.brani = catalogBrani;
        }
        if (serata) {
          const currentSerata = {
            id: Date.now(),
            metadata: cloudSnapshotIsOlder ? (storedSerata?.metadata || serata) : serata,
            brani: mergedBrani,
            savedAt: cloudSnapshotIsOlder ? storedSerata.savedAt : (updatedAt || new Date().toISOString())
          };
          if (typeof BORDERO_CONFIG !== 'undefined') {
            Storage.set(BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA, currentSerata);
          }
        }
      }

      // 3. Notifica display monitor o next-coreo per ridisegnare la UI
      if (typeof window !== 'undefined') {
        if (window.displayMonitor && typeof window.displayMonitor.refresh === 'function') {
          window.displayMonitor.syncDataSnapshot();
          window.displayMonitor.refresh();
        }
        if (window.nextCoreoDisplay && typeof window.nextCoreoDisplay.refresh === 'function') {
          window.nextCoreoDisplay.refresh();
        }
        window.dispatchEvent(new CustomEvent('bordero:cloud-updated', { detail: payload }));
      }
    }

    clearExpiredStoredSerata() {
      if (typeof Storage === 'undefined' || typeof BORDERO_CONFIG === 'undefined') return;
      const key = BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA;
      const currentSerata = Storage.get(key, null);
      const savedAt = Date.parse(currentSerata?.savedAt || '');
      const ageMs = Date.now() - savedAt;
      if (!Number.isFinite(savedAt) || ageMs > MAX_CLOUD_STATE_AGE_MS || ageMs < -MAX_FUTURE_CLOCK_SKEW_MS) {
        Storage.remove(key);
        if (typeof window !== 'undefined' && window.displayMonitor?.refresh) {
          window.displayMonitor.refresh();
        }
      }
    }

    /**
     * Configura i trigger per sincronizzare automaticamente dallo spazio locale a Firebase
     */
    setupLocalSyncTriggers() {
      const handleLocalChange = () => {
        if (this.localPushDebounceTimer) clearTimeout(this.localPushDebounceTimer);
        this.localPushDebounceTimer = setTimeout(() => {
          this.pushCurrentLocalStateToBackend();
        }, 300);
      };

      window.addEventListener('bordero:serata-updated', handleLocalChange);
      window.addEventListener('bordero:next-coreo-updated', handleLocalChange);
      window.addEventListener('bordero:data-updated', handleLocalChange);
      window.addEventListener('storage', (event) => {
        if (event.key && (event.key.includes('currentSerata') || event.key.includes('next_coreo') || event.key.includes('brani'))) {
          handleLocalChange();
        }
      });
    }

    async pushCurrentLocalStateToBackend() {
      try {
        await this.authReady;
        const user = this.publisherAuth?.currentUser;
        if (!user) {
          this.updateStatusBadge(false, '🔒 Accedi per sincronizzare');
          return;
        }
        await this.publishState(this.getCurrentLocalState());
      } catch (error) {
        console.error('[FirebaseCloudClient] Pubblicazione locale non riuscita:', error);
      }
    }

    getCurrentLocalState() {
      let currentSerata = null;
      if (typeof dataLoader !== 'undefined' && typeof dataLoader.getCurrentSerata === 'function') {
        currentSerata = dataLoader.getCurrentSerata();
      } else if (typeof Storage !== 'undefined' && typeof BORDERO_CONFIG !== 'undefined') {
        currentSerata = Storage.get(BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA, null);
      }

      const nextCoreo = typeof Storage !== 'undefined'
        ? Storage.get('bordero_next_coreo_selection', null)
        : null;
      const brani = Array.isArray(currentSerata?.brani)
        ? currentSerata.brani
        : (typeof dataLoader !== 'undefined' && Array.isArray(dataLoader.brani) ? dataLoader.brani : []);

      return {
        nextCoreo: nextCoreo?.title || nextCoreo?.nextValue || '--',
        serata: currentSerata?.metadata || {},
        brani,
        catalogBrani: typeof Storage !== 'undefined'
          ? Storage.get('BORDERO_BRANI_DATA', null)
            || (typeof dataLoader !== 'undefined' && Array.isArray(dataLoader.brani)
              ? dataLoader.brani
              : Storage.get(BORDERO_CONFIG.CACHE_KEY_BRANI, []))
          : []
      };
    }

    async publishState(payload = {}) {
      await this.authReady;
      const user = this.publisherAuth?.currentUser;
      if (!user || !this.isAuthorizedPublisher(user)) {
        this.updateStatusBadge(false, '🔒 Account Google non autorizzato');
        throw new Error('Accedi con uno degli account Google autorizzati per pubblicare.');
      }
      if (!this.publisherDatabase) {
        throw new Error('Firebase Realtime Database non è inizializzato.');
      }

      const state = {
        ...(this.latestCloudState || {}),
        ...this.getCurrentLocalState(),
        ...payload,
        updatedAt: new Date().toISOString(),
        source: 'bordero-google-auth'
      };
      const databasePath = this.syncPath.replace(/\.json$/, '').replace(/^\/+/, '');

      try {
        await this.publisherDatabase.ref(databasePath).set(state);
        this.latestCloudState = state;
        this.isConnected = true;
        this.updateStatusBadge(true, '🟢 Cloud aggiornato');
        return state;
      } catch (error) {
        const denied = error?.code === 'PERMISSION_DENIED'
          || /permission_denied|permission denied/i.test(error?.message || '');
        this.updateStatusBadge(false, denied ? '🔒 Scrittura RTDB negata' : '⚠️ Errore sync Cloud');
        throw error;
      }
    }

    injectStatusIndicator() {
      if (typeof document === 'undefined') return;
      const inject = () => {
        const header = document.querySelector('.display-header') || document.querySelector('header');
        if (!header) return;

        let badge = document.getElementById('firebase-cloud-badge');
        if (!badge && (!this.isPublisherPage || this.isCloudHost)) {
          badge = document.createElement('div');
          badge.id = 'firebase-cloud-badge';
          badge.style.cssText = `
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.5px;
          background: rgba(0,0,0,0.4);
          color: #a0aec0;
          border: 1px solid rgba(255,255,255,0.15);
          margin-left: 10px;
          vertical-align: middle;
        `;
          badge.textContent = this.isCloudHost ? '🟡 Connessione Cloud...' : '🟢 Server Locale';
          const titleContainer = document.querySelector('.display-title-row')
            || header.querySelector('.header-content')
            || header;
          titleContainer.appendChild(badge);
        }

        if (this.isAdminPage && !this.isCloudHost) {
          document.getElementById('google-account-section')?.removeAttribute('hidden');
          const authButton = document.getElementById('firebase-cloud-auth');
          const publishButton = document.getElementById('firebase-cloud-publish');
          if (authButton && !authButton.dataset.firebaseAuthBound) {
            authButton.dataset.firebaseAuthBound = 'true';
            authButton.addEventListener('click', () => this.togglePublisherAuth());
          }
          if (publishButton && !publishButton.dataset.firebasePublishBound) {
            publishButton.dataset.firebasePublishBound = 'true';
            publishButton.addEventListener('click', () => this.pushCurrentLocalStateToBackend());
          }
          this.updatePublisherControls();
          if (!this.publisherAuth) {
            this.updateStatusBadge(false, '🔒 Inizializzo accesso Google');
          } else if (this.publisherAuth.currentUser) {
            this.updateStatusBadge(true, `🔐 ${this.publisherAuth.currentUser.email || 'Google'}`);
          } else {
            this.updateStatusBadge(false, '🔒 Accedi per sincronizzare');
          }
        }
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject, { once: true });
      } else {
        inject();
      }
    }

    updateStatusBadge(isOnline, text) {
      const badge = document.getElementById('firebase-cloud-badge');
      if (!badge) return;
      badge.textContent = text;
      if (isOnline) {
        badge.style.color = '#48bb78';
        badge.style.borderColor = 'rgba(72,187,120,0.4)';
        badge.style.background = 'rgba(72,187,120,0.1)';
      } else {
        badge.style.color = '#ecc94b';
        badge.style.borderColor = 'rgba(236,201,75,0.4)';
        badge.style.background = 'rgba(236,201,75,0.1)';
      }
    }
  }

  // Istanziazione globale
  if (typeof window !== 'undefined') {
    window.firebaseCloudClient = new FirebaseCloudClient();
  }
})();
