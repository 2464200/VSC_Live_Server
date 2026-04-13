/**
 * API Config Helper - Server Unificato
 * Tutto punta alla porta 5500
 */

window.APIConfig = {
    // Parametri fissi per server unificato
    HOSTNAME: window.location.hostname || 'localhost',
    PROTOCOL: window.location.protocol || 'http:',
    PORT: 5500,

    // Timeout
    TIMEOUT_MS: 5000,

    /**
     * Ottiene URL base del server
     */
    getServerUrl() {
        return `${this.PROTOCOL}//${this.HOSTNAME}:${this.PORT}`;
    },

    /**
     * Verifica se il server è disponibile
     */
    async isServerAvailable() {
        try {
            const url = `${this.getServerUrl()}/api/pdf-list`;
            const ctrl = new AbortController();
            const timeout = setTimeout(() => ctrl.abort(), 2000);

            const response = await fetch(url, {
                signal: ctrl.signal,
                method: 'GET',
                mode: 'cors'
            });

            clearTimeout(timeout);
            return response.ok;
        } catch (e) {
            return false;
        }
    },

    /**
     * Fetch semplificato verso API Server
     */
    async fetchAPI(endpoint, options = {}) {
        const url = `${this.getServerUrl()}${endpoint}`;

        console.log(`📡 Fetch: ${url}`);

        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), this.TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                ...options,
                signal: ctrl.signal,
                mode: 'cors'
            });

            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} - ${response.statusText}`);
            }

            console.log(`✅ Fetch riuscito`);
            return response;

        } catch (error) {
            clearTimeout(timeout);
            const errorMsg = error.message || String(error);
            console.error(`❌ Fetch fallito: ${errorMsg}`);
            throw error;
        }
    }
};

console.log('📚 APIConfig helper caricato - Host: ' + window.APIConfig.HOSTNAME);
