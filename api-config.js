/**
 * API Config Helper con Server Manager
 * Rileva dinamicamente l'host e la porta del PDF Server
 * Gestisce auto-start, retry, fallback
 */

window.APIConfig = {
    // Parametri dinamici
    get HOSTNAME() {
        return window.location.hostname || 'localhost';
    },
    
    get PROTOCOL() {
        return window.location.protocol || 'http:';
    },
    
    // Server Manager porta
    MANAGER_PORT: 3000,
    
    // Porte da tentare per PDF Server (in ordine di priorità)
    PORTS: [8765, 5500, 3000],
    
    // Timeout e retry
    TIMEOUT_MS: 5000,
    MAX_RETRIES: 2,
    
    // Stato attuale
    __currentPort: null,
    __isAvailable: false,
    __managerAvailable: false,
    __serverAutoStarted: false,
    
    /**
     * Ottiene URL del manager
     */
    getManagerUrl() {
        return `${this.PROTOCOL}//${this.HOSTNAME}:${this.MANAGER_PORT}`;
    },
    
    /**
     * Ottiene URL del server con host-porta dinamici
     * @param {number} port - Porta specifica (opzionale)
     */
    getServerUrl(port) {
        const p = port || this.__currentPort || 8765;
        return `${this.PROTOCOL}//${this.HOSTNAME}:${p}`;
    },
    
    /**
     * Verifica se il Server Manager è disponibile
     */
    async isManagerAvailable() {
        try {
            const url = `${this.getManagerUrl()}/api/manager/health`;
            const ctrl = new AbortController();
            const timeout = setTimeout(() => ctrl.abort(), 2000);
            
            const response = await fetch(url, {
                signal: ctrl.signal,
                method: 'GET',
                mode: 'cors'
            });
            
            clearTimeout(timeout);
            
            if (response.ok) {
                console.log('✅ Server Manager disponibile');
                this.__managerAvailable = true;
                return true;
            }
        } catch (e) {
            console.warn('⚠️  Server Manager non disponibile');
        }
        
        this.__managerAvailable = false;
        return false;
    },
    
    /**
     * Chiede al Server Manager di avviare il PDF Server
     */
    async requestStartServer() {
        if (!this.__managerAvailable) {
            console.warn('⚠️  Server Manager non disponibile - Skip auto-start');
            return false;
        }
        
        try {
            const url = `${this.getManagerUrl()}/api/manager/start`;
            const response = await fetch(url, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('✅ PDF Server avviato via Manager (PID: ' + data.pid + ')');
                this.__serverAutoStarted = true;
                return true;
            }
        } catch (error) {
            console.error('❌ Errore avvio server:', error);
        }
        
        return false;
    },
    
    /**
     * Chiede al Server Manager di fermare il PDF Server
     */
    async requestStopServer() {
        if (!this.__managerAvailable) {
            console.warn('⚠️  Server Manager non disponibile - Skip stop');
            return false;
        }
        
        try {
            const url = `${this.getManagerUrl()}/api/manager/stop`;
            const response = await fetch(url, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('✅ PDF Server fermato via Manager');
                this.__serverAutoStarted = false;
                return true;
            }
        } catch (error) {
            console.error('❌ Errore stop server:', error);
        }
        
        return false;
    },
    
    /**
     * Segnala attività al Server Manager
     */
    async signalActivity() {
        if (!this.__managerAvailable) return;
        
        try {
            const url = `${this.getManagerUrl()}/api/manager/activity`;
            fetch(url, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' }
            }).catch(() => {});
        } catch (e) {}
    },
    
    /**
     * Rileva quale porta è disponibile
     */
    async detectAvailablePort() {
        console.log(`🔍 Rilevamento host: ${this.HOSTNAME}`);
        
        for (const port of this.PORTS) {
            try {
                const url = `${this.PROTOCOL}//${this.HOSTNAME}:${port}/api/pdf-list`;
                console.log(`   Tentando porta ${port}...`);
                
                const ctrl = new AbortController();
                const timeout = setTimeout(() => ctrl.abort(), this.TIMEOUT_MS);
                
                const response = await fetch(url, {
                    signal: ctrl.signal,
                    method: 'GET',
                    mode: 'cors'
                });
                
                clearTimeout(timeout);
                
                if (response.ok) {
                    this.__currentPort = port;
                    this.__isAvailable = true;
                    console.log(`✅ PDF Server rilevato su porta ${port}`);
                    return port;
                }
            } catch (e) {
                console.log(`⚠️  Porta ${port} non risponderebbe: ${e.message}`);
            }
        }
        
        console.warn(`❌ PDF Server non trovato su nessune porte: ${this.PORTS.join(', ')}`);
        this.__isAvailable = false;
        return null;
    },
    
    /**
     * Fetch con retry automatico verso API Server
     */
    async fetchAPI(endpoint, options = {}) {
        // Rileva porta se non già fatto
        if (this.__currentPort === null) {
            const detectedPort = await this.detectAvailablePort();
            if (!detectedPort) {
                throw new Error('PDF Server non disponibile - controlla che il Manager sia attivo (node server-manager.js)');
            }
        }

        const url = `${this.getServerUrl()}${endpoint}`;
        let lastError;
        
        console.log(`📡 Fetch: ${url}`);
        
        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                // Segnala attività
                this.signalActivity();
                
                const ctrl = new AbortController();
                const timeout = setTimeout(() => ctrl.abort(), this.TIMEOUT_MS);
                
                const response = await fetch(url, {
                    ...options,
                    signal: ctrl.signal,
                    mode: 'cors'
                });
                
                clearTimeout(timeout);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} - ${response.statusText}`);
                }
                
                console.log(`✅ Fetch riuscito (tentativo ${attempt})`);
                return response;
                
            } catch (error) {
                lastError = error;
                const errorMsg = error.message || String(error);
                console.warn(`⚠️  Tentativo ${attempt}/${this.MAX_RETRIES} fallito: ${errorMsg}`);
                
                if (attempt < this.MAX_RETRIES) {
                    // Backoff esponenziale: 500ms, 1000ms
                    const delayMs = 500 * attempt;
                    console.log(`   Ripprovo tra ${delayMs}ms...`);
                    await new Promise(r => setTimeout(r, delayMs));
                }
            }
        }
        
        const finalError = `Fetch fallito dopo ${this.MAX_RETRIES} tentativi: ${lastError?.message || 'sconociuto'}`;
        console.error(`❌ ${finalError}`);
        throw new Error(finalError);
    }
};

/**
 * Funzione globale per testare la connessione al server
 */
window.testServerConnection = async function() {
    console.log('🔌 Test connessione server...');
    try {
        const port = await window.APIConfig.detectAvailablePort();
        if (port) {
            console.log(`✅ Server disponibile su http://${window.APIConfig.HOSTNAME}:${port}`);
            return true;
        } else {
            console.error('❌ Server non disponibile');
            return false;
        }
    } catch (error) {
        console.error('❌ Errore test:', error);
        return false;
    }
};

console.log('📚 APIConfig helper caricato - Host: ' + window.APIConfig.HOSTNAME);
