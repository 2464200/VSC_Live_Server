/**
 * utility.js - Helper globali per fetch robusti e error handling
 * Inclusione: <script src="/utility.js"></script>
 */

// Configurazione global
function getCanonicalProjectOrigin() {
    const protocol = window.location.protocol === "file:" ? "http:" : (window.location.protocol || "http:");
    const host = window.location.hostname || "127.0.0.1";
    const port = window.location.port || "";

    if (window.location.origin && window.location.origin !== "null" && port === "5500") {
        return window.location.origin;
    }

    return `${protocol}//${host}:5500`;
}

window.AppConfig = {
    PDF_SERVER_URL: getCanonicalProjectOrigin(),
    LIVE_SERVER_URL: getCanonicalProjectOrigin(),
    FETCH_TIMEOUT: 10000,
    FETCH_RETRIES: 2,
    DEBUG: true
};

/**
 * Fetch robusto con timeout e retry
 * @param {string} url - URL da recuperare
 * @param {object} options - Opzioni di fetch standard
 * @param {number} timeout - Timeout in ms (default: 10000)
 * @param {number} retries - Numero di tentativi (default: 2)
 * @returns {Promise<Response>}
 */
async function fetchWithTimeoutAndRetry(url, options = {}, timeout = window.AppConfig.FETCH_TIMEOUT, retries = window.AppConfig.FETCH_RETRIES) {
    let lastError;
    
    for (let attempt = 1; attempt <= (retries + 1); attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                cache: options.cache || "no-store"
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            if (window.AppConfig.DEBUG) {
                console.log(`✅ [Fetch] ${url} - Attempt ${attempt}/${retries + 1} - Success`);
            }
            
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            lastError = error;
            
            const isTimeout = error.name === "AbortError";
            const msg = isTimeout ? "Timeout" : error.message;
            
            if (window.AppConfig.DEBUG) {
                console.warn(`⚠️  [Fetch] ${url} - Attempt ${attempt}/${retries + 1} - ${msg}`);
            }
            
            if (attempt <= retries) {
                // Backoff esponenziale
                await new Promise(r => setTimeout(r, 500 * attempt));
            }
        }
    }
    
    throw lastError;
}

/**
 * Carica un CSV e ritorna array di righe (salto le prime 3 righe di headers)
 * @param {string} fileName - Nome del file (es. "display.csv")
 * @param {boolean} skipFirstThreeLines - Se true, salta le prime 3 righe
 * @returns {Promise<Array<Array<string>>>}
 */
async function loadCSV(fileName, skipFirstThreeLines = true) {
    const url = fileName + "?t=" + Date.now();
    
    try {
        const response = await fetchWithTimeoutAndRetry(url);
        const text = await response.text();
        
        // Rimuovi BOM se presente
        const cleanText = text.replace(/^\uFEFF/, "").trim();
        const lines = cleanText.split('\n');
        
        // Parse CSV semplice (non gestisce quoted fields con virgole)
        const rows = lines.map(line => 
            line.split(',').map(cell => cell.replace(/^["']|["']$/g, '').trim())
        );
        
        if (skipFirstThreeLines) {
            return rows.slice(3);
        }
        
        return rows;
    } catch (error) {
        console.error(`❌ Errore caricamento ${fileName}:`, error);
        throw error;
    }
}

/**
 * Verifica se il server PDF è disponibile
 * @returns {Promise<boolean>}
 */
async function isPdfServerAvailable() {
    try {
        const response = await fetchWithTimeoutAndRetry(
            window.AppConfig.PDF_SERVER_URL + "/api/pdf-list",
            {},
            3000,  // Timeout breve per test
            1      // Solo 1 tentativo
        );
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * Fetch verso il server PDF
 * @param {string} endpoint - Endpoint (es. "/api/pdf-list")
 * @param {object} options - Opzioni di fetch
 * @returns {Promise<Response>}
 */
async function fetchPdfServer(endpoint, options = {}) {
    const url = window.AppConfig.PDF_SERVER_URL + endpoint;
    return fetchWithTimeoutAndRetry(url, options);
}

/**
 * Mostra un messaggio di errore e lo registra nella console
 * @param {string} message - Messaggio da mostrare
 * @param {string} type - Tipo: "error" | "warning" | "info"
 * @param {number} duration - Durata in ms (0 = permanente)
 */
function showNotification(message, type = "info", duration = 5000) {
    const existing = document.getElementById("app-notification");
    if (existing) existing.remove();
    
    const notification = document.createElement("div");
    notification.id = "app-notification";
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Stile base
    Object.assign(notification.style, {
        position: "fixed",
        top: "20px",
        right: "20px",
        padding: "15px 20px",
        borderRadius: "5px",
        zIndex: "10000",
        fontFamily: "Arial, sans-serif",
        maxWidth: "400px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)"
    });
    
    // Colori basati sul tipo
    const colorMap = {
        error: { bg: "#dc3545", color: "#fff" },
        warning: { bg: "#ffc107", color: "#000" },
        info: { bg: "#17a2b8", color: "#fff" },
        success: { bg: "#28a745", color: "#fff" }
    };
    
    const colors = colorMap[type] || colorMap.info;
    notification.style.backgroundColor = colors.bg;
    notification.style.color = colors.color;
    
    document.body.appendChild(notification);
    
    // Log nella console
    const logFunc = type === "error" ? console.error : (type === "warning" ? console.warn : console.log);
    logFunc(`[${type.toUpperCase()}]`, message);
    
    if (duration > 0) {
        setTimeout(() => notification.remove(), duration);
    }
    
    return notification;
}

/**
 * Inizializza l'app: controlla la disponibilità del server
 * @returns {Promise<{pdfServerAvailable: boolean}>}
 */
async function initApp() {
    if (window.AppConfig.DEBUG) {
        console.log("🚀 Inicializzazione app...");
        console.log("📍 Config:", window.AppConfig);
    }
    
    const pdfServerAvailable = await isPdfServerAvailable();
    
    if (pdfServerAvailable) {
        if (window.AppConfig.DEBUG) {
            console.log("✅ PDF Server disponibile su", window.AppConfig.PDF_SERVER_URL);
        }
    } else {
        if (window.AppConfig.DEBUG) {
            console.warn("⚠️  PDF Server NON disponibile su", window.AppConfig.PDF_SERVER_URL);
            console.warn("💡 Avvia con: powershell .\\start-pdf-server.ps1");
        }
    }
    
    return {
        pdfServerAvailable
    };
}

// Esporta in window global
window.Utils = {
    fetchWithTimeoutAndRetry,
    loadCSV,
    isPdfServerAvailable,
    fetchPdfServer,
    showNotification,
    initApp
};

if (window.AppConfig.DEBUG) {
    console.log("✅ utility.js caricato");
}
