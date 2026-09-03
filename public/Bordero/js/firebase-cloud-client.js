/**
 * BORDERO - Firebase Realtime Cloud Client
 * Gestisce la sincronizzazione cloud bidirezionale:
 * - Su Web/Firebase Hosting: riceve gli aggiornamenti live (SSE / Polling) in tempo reale senza ricaricare la pagina.
 * - In Locale (VS Code / PC): invia lo stato aggiornato a Firebase tramite il server unificato.
 */

(function () {
  'use strict';

  class FirebaseCloudClient {
    constructor() {
      this.dbUrl = (typeof BORDERO_CONFIG !== 'undefined' && BORDERO_CONFIG?.FIREBASE_REALTIME_DB_URL)
        || 'https://my-project-1525790600392-default-rtdb.firebaseio.com';
      this.syncPath = '/bordero/display_state.json';
      this.isCloudHost = this.detectCloudHost();
      this.eventSource = null;
      this.pollingTimer = null;
      this.lastStateTimestamp = null;
      this.isConnected = false;
      this.localPushDebounceTimer = null;

      this.init();
    }

    detectCloudHost() {
      if (typeof window === 'undefined' || !window.location) return false;
      const host = window.location.hostname.toLowerCase();
      const search = window.location.search.toLowerCase();
      return (
        host.includes('web.app') ||
        host.includes('firebaseapp.com') ||
        host.includes('github.io') ||
        search.includes('cloud=1') ||
        search.includes('cloudsync=1')
      );
    }

    init() {
      if (this.isCloudHost) {
        console.log('[FirebaseCloudClient] Modalità Cloud attiva (Host:', window.location.hostname, ')');
        this.startCloudListener();
      } else {
        console.log('[FirebaseCloudClient] Modalità Locale attiva. Sincronizzazione automatica verso Cloud.');
        this.setupLocalSyncTriggers();
        window.setTimeout(() => this.pushCurrentLocalStateToBackend(), 1500);
      }
      this.injectStatusIndicator();
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
          }
        } else {
          this.updateStatusBadge(false, '🟡 Cloud Inattivo');
        }
      } catch (err) {
        this.updateStatusBadge(false, '⚪ Offline');
      }
    }

    /**
     * Applica lo stato cloud al DOM e allo storage locale
     */
    handleCloudState(payload) {
      if (!payload || typeof payload !== 'object') return;

      const { nextCoreo, serata, brani, updatedAt } = payload;

      if (updatedAt && updatedAt === this.lastStateTimestamp) {
        return; // Nessuna variazione
      }
      this.lastStateTimestamp = updatedAt || new Date().toISOString();

      // 1. Aggiorna Prossima Coreo
      if (nextCoreo) {
        if (typeof Storage !== 'undefined' && Storage.set) {
          Storage.set('bordero_next_coreo_selection', { title: nextCoreo });
        }
        const nextCoreoEl = document.getElementById('next-coreo');
        if (nextCoreoEl) {
          nextCoreoEl.textContent = nextCoreo;
        }
      }

      // 2. Aggiorna Serata & Brani
      if (typeof Storage !== 'undefined' && Storage.set) {
        if (Array.isArray(brani) && brani.length > 0) {
          Storage.set('BORDERO_BRANI_DATA', brani);
          if (typeof BORDERO_CONFIG !== 'undefined') {
            Storage.set(BORDERO_CONFIG.CACHE_KEY_BRANI, brani);
          }
        }

        if (serata) {
          const currentSerata = {
            id: Date.now(),
            metadata: serata,
            brani: Array.isArray(brani) ? brani : [],
            savedAt: updatedAt || new Date().toISOString()
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
      window.addEventListener('storage', (event) => {
        if (event.key && (event.key.includes('currentSerata') || event.key.includes('next_coreo') || event.key.includes('brani'))) {
          handleLocalChange();
        }
      });
    }

    async pushCurrentLocalStateToBackend() {
      try {
        let currentSerata = null;
        let nextCoreoVal = '--';

        if (typeof dataLoader !== 'undefined' && typeof dataLoader.getCurrentSerata === 'function') {
          currentSerata = dataLoader.getCurrentSerata();
        } else if (typeof Storage !== 'undefined' && typeof BORDERO_CONFIG !== 'undefined') {
          currentSerata = Storage.get(BORDERO_CONFIG.CACHE_KEY_CURRENT_SERATA, null);
        }

        if (typeof Storage !== 'undefined') {
          const nextCoreoObj = Storage.get('bordero_next_coreo_selection', null);
          if (nextCoreoObj) {
            nextCoreoVal = nextCoreoObj.title || nextCoreoObj.nextValue || '--';
          }
        }

        const payload = {
          nextCoreo: nextCoreoVal,
          serata: currentSerata?.metadata || {},
          brani: currentSerata?.brani || (typeof dataLoader !== 'undefined' ? dataLoader.brani : [])
        };

        await fetch('/api/bordero/cloud-sync-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (_) {
        // Fallback silenzioso in locale se il server unificato ha il sync via filesystem watcher
      }
    }

    injectStatusIndicator() {
      if (typeof document === 'undefined') return;
      document.addEventListener('DOMContentLoaded', () => {
        const header = document.querySelector('.display-header') || document.querySelector('header');
        if (!header || document.getElementById('firebase-cloud-badge')) return;

        const badge = document.createElement('div');
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

        const titleContainer = document.querySelector('.display-title-row') || header;
        titleContainer.appendChild(badge);
      });
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
