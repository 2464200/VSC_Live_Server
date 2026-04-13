**⚠️ Nota importante:** a partire dal 13 Apr 2026 il flusso standard del progetto usa un unico unified-server.js su http://localhost:5500. Le architetture con server-manager.js, pdf-server.js, simple-server.js, static-server.js, pdf-server-simple.js e le porte 3000, 3010, 8765 sono ora legacy/historiche e non fanno parte del percorso standard.

# Server Manager - Guida (LEGACY)

**IMPORTANTE:** Questo documento descrive l'architettura legacy del progetto. Dal 13 Aprile 2026, il progetto usa un unico **unified-server.js** su porta 5500 che integra tutte le funzionalità precedentemente distribuite su server multipli.

## Stato Attuale

Il sistema funziona ora con un'**architettura unificata**:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    BROWSER (Utente)                          â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                    Pagine HTML                               â”‚
â”‚               â†“ (fetch diretto)                              â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚          UNIFIED SERVER (porta 5500)                        â”‚
â”‚   - Pagine statiche (HTML/CSS/JS)                           â”‚
â”‚   - API PDF (/api/pdf-*)                                    â”‚
â”‚   - API Eventi (/api/eventi/*)                              â”‚
â”‚   - API Diagnostica (/api/ping, etc.)                       â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Avvio Semplificato

```powershell
cd C:\VSC_Live_Server
.\startup.ps1 -NoWait
```

Poi apri le pagine direttamente su `http://localhost:5500/...`

## Architettura Legacy (STORICA)

Il sistema funziona con una **architettura a tre livelli**:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    BROWSER (Utente)                          â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                    ScriptPDF1.html                           â”‚
â”‚               â†“ (fetch con auto-start)                       â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚          TIER 1: Live Server (porta 5500)                   â”‚
â”‚   Serve le pagine HTML (index.html, servizio2.html, etc)   â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚          TIER 2: Server Manager (porta 3000)                â”‚
â”‚   Gestisce il ciclo di vita del PDF Server                 â”‚
â”‚   - /api/start-pdf-server (avvia)                           â”‚
â”‚   - /api/stop-pdf-server (arresta)                          â”‚
â”‚   - /api/status (stato)                                     â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚          TIER 3: PDF Server (porta 8765)                    â”‚
â”‚   API per gestire PDF:                                      â”‚
â”‚   - /api/pdf-list (lista PDF)                               â”‚
â”‚   - /api/open-pdf (apri PDF su schermo)                     â”‚
â”‚   - /api/close-chrome (chiudi visualizzatore)               â”‚
â”‚   âš ï¸ AVVIATO E FERMATO AUTOMATICAMENTE                       â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Flusso Automatico

```
Utente apre
ScriptPDF1.html
      â†“
DOMContentLoaded
      â†“
setupServerLifecycle()
      â†“
APIConfig.ensurePdfServerRunning()
      â†“
POST http://localhost:3000/api/start-pdf-server
      â†“
Server Manager spawna pdf-server.js
      â†“
PDF Server risponde su porta 8765
      â†“
Pagina carica lista PDF e li mostra
      â†“
Utente chiude tab/browser
      â†“
beforeunload event
      â†“
cleanupServer()
      â†“
POST http://localhost:3000/api/stop-pdf-server
      â†“
Server Manager termina pdf-server.js
```

---

## ðŸš€ Avvio Rapido

### Primo Avvio (Una Sola Volta)

```powershell
# 1. Apri PowerShell nella cartella del progetto
cd C:\VSC_Live_Server

# 2. Avvia il Server Manager (settati una sola volta)
.\start-server-manager.ps1
# Aspetta il messaggio: âœ… Server Manager avviato su porta 3000

# 3. In un'ALTRA finestra PowerShell, avvia Live Server
.\launch-all.ps1
# Oppure manualmente:
npx http-server -c-1 -p 5500
```

### Uso Quotidiano

```powershell
# 1. Avvia il tutto con un comando
.\launch-all.ps1

# 2. Apri il browser su:
# http://localhost:5500/Prova/ScriptPDF1.html

# 3. La pagina auto-avvia il PDF Server

# 4. Quando chiudi la pagina, il server auto-si-spegne

# 5. Alla fine, per fermare tutto:
.\stop-server-manager.ps1
```

---

## ðŸ”„ Come Funziona

### Phase 1: Startup del Server Manager

Quando esegui `.\start-server-manager.ps1`:

1. **Verifica se Ã¨ giÃ  in esecuzione**
   ```powershell
   Get-Process -Name "node" | Where {$_.CommandLine -match "server-manager"}
   ```

2. **Se non esiste, lo avvia**
   ```powershell
   Start-Process -NoWindow node -ArgumentList "server-manager.js"
   ```

3. **Aspetta che la porta 3000 sia pronta**
   ```powershell
   # Loop di verifica fino a 30 secondi
   while (-not $portOpen -and $elapsed -lt 30000)
   ```

4. **Rimane in ascolto su http://localhost:3000**
   - Accetta richieste per `/api/start-pdf-server`
   - Accetta richieste per `/api/stop-pdf-server`
   - Accetta richieste per `/api/status`

### Phase 2: Apertura della Pagina HTML

Quando l'utente apre `ScriptPDF1.html`:

1. **Le dipendenze si caricano**
   ```html
   <script src="/api-config.js"></script>
   ```

2. **Al caricamento del DOM (DOMContentLoaded)**
   ```javascript
   document.addEventListener("DOMContentLoaded", async function() {
       console.log("âœ… DOM caricato - Configurazione server");
       
       // Chiede al Server Manager di avviare il PDF Server
       await setupServerLifecycle();
       
       // Carica i dati dei PDF
       await loadPdfData();
   });
   ```

3. **setupServerLifecycle() chiama**
   ```javascript
   // Contatta Server Manager
   const response = await fetch(
       "http://localhost:3000/api/start-pdf-server",
       { method: "POST" }
   );
   
   // Server Manager spawna pdf-server.js
   // pdf-server.js avvia Express sulla porta 8765
   ```

4. **api-config.js fa health check**
   ```javascript
   // Controlla se il server Ã¨ pronto
   const health = await fetch("http://localhost:8765/api/pdf-list");
   if (health.ok) {
       console.log("âœ… PDF Server pronto!");
   }
   ```

5. **Carica i dati**
   ```javascript
   // Ora che il server Ã¨ pronto, carica i PDF
   const pdfList = await fetch("http://localhost:8765/api/pdf-list");
   const files = await pdfList.json();
   ```

### Phase 3: Interazione Utente

L'utente puÃ²:

```javascript
// Aprire un PDF
async function openCurrentPdf() {
    if (!serverReady) {
        alert("Server non pronto");
        return;
    }
    
    // Chiede al PDF Server di aprire Chrome
    const response = await APIConfig.fetchAPI("/api/open-pdf", {
        method: "POST",
        body: JSON.stringify({ filePath: selectedFile })
    });
}

// Chiudere il visualizzatore
async function closePdfViewer() {
    const response = await APIConfig.fetchAPI("/api/close-chrome", {
        method: "POST"
    });
}
```

### Phase 4: Chiusura della Pagina

Quando l'utente chiude il tab o la pagina:

```javascript
window.addEventListener('beforeunload', async function(event) {
    console.log("ðŸ‘‹ Pagina in chiusura - Pulizia server");
    
    // Ferma il PDF Server
    try {
        const response = await fetch(
            "http://localhost:3000/api/stop-pdf-server",
            { method: "POST", keepalive: true }  // keepalive = funziona anche se il tab si chiude
        );
        console.log("âœ… PDF Server fermato");
    } catch (error) {
        console.warn("âš ï¸ Errore nella chiusura:", error.message);
    }
});
```

Server Manager:
- Riceve la richiesta di stop
- Invia segnale SIGTERM a pdf-server.js
- pdf-server.js pulisce e si chiude
- Chiude la porta 8765

---

## ðŸ“¦ Componenti

### 1. **server-manager.js** (TIER 2)

File: `C:\VSC_Live_Server\server-manager.js`

**ResponsabilitÃ :**
- Rimane sempre attivo (avviato con `start-server-manager.ps1`)
- Ascolta su porta 3000
- Gestisce il ciclo di vita di pdf-server.js

**Endpoint:**
- `POST /api/start-pdf-server` â†’ Avvia pdf-server.js
- `POST /api/stop-pdf-server` â†’ Ferma pdf-server.js
- `GET /api/status` â†’ Ritorna lo stato (running/stopped)

**Codice chiave:**
```javascript
const PORT = process.env.SERVER_MANAGER_PORT || 3000;
let pdfServerProcess = null;

// Avvia il PDF Server quando richiesto
app.post('/api/start-pdf-server', (req, res) => {
    if (pdfServerProcess) {
        return res.json({ success: true, message: "PDF Server giÃ  in esecuzione" });
    }
    
    // Spawna pdf-server.js come child process
    pdfServerProcess = spawn('node', ['pdf-server.js'], {
        stdio: 'inherit',
        detached: false
    });
    
    pdfServerProcess.on('error', (error) => {
        console.error("âŒ Errore pdf-server:", error);
        pdfServerProcess = null;
    });
    
    res.json({ success: true, message: "PDF Server avviato" });
});

// Ferma il PDF Server
app.post('/api/stop-pdf-server', (req, res) => {
    if (!pdfServerProcess) {
        return res.json({ success: true, message: "PDF Server non in esecuzione" });
    }
    
    pdfServerProcess.kill('SIGTERM');
    pdfServerProcess = null;
    
    res.json({ success: true, message: "PDF Server fermato" });
});
```

### 2. **api-config.js** (Client-side)

File: `C:\VSC_Live_Server\api-config.js`

**ResponsabilitÃ :**
- Auto-start del PDF Server
- Health checks
- Retry logic con timeout

**Funzioni principali:**
```javascript
// Auto-start del server
async function ensurePdfServerRunning() {
    try {
        const response = await fetch(
            "http://localhost:3000/api/start-pdf-server",
            { 
                method: "POST",
                timeout: 5000
            }
        );
        return response.ok;
    } catch (error) {
        console.error("Errore nell'avvio:", error);
        return false;
    }
}

// Wrapper per tutte le fetch al PDF Server
async function fetchAPI(endpoint, options = {}) {
    // Assicura che il server sia avviato
    await ensurePdfServerRunning();
    
    // Retry logic
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const url = `http://localhost:8765${endpoint}`;
            const response = await fetch(url, {
                ...options,
                timeout: 8000
            });
            
            if (response.ok) return response;
            
            if (attempt < 2) {
                await new Promise(r => setTimeout(r, 500));
            }
        } catch (error) {
            console.warn(`Tentativo ${attempt} fallito:`, error.message);
            if (attempt === 2) throw error;
            await new Promise(r => setTimeout(r, 500));
        }
    }
}
```

### 3. **ScriptPDF1.html** (Interface Utente)

File: `C:\VSC_Live_Server\Prova\ScriptPDF1.html`

**ResponsabilitÃ :**
- Interfaccia grafica per visualizzare PDF
- Lifecycle management (setupServerLifecycle, cleanupServer)
- Comunicazione con api-config.js

**Codice chiave:**
```html
<!-- Carica api-config.js per la gestione server -->
<script src="/api-config.js"></script>

<script>
// Al caricamento della pagina
document.addEventListener("DOMContentLoaded", async function() {
    console.log("âœ… Pagina caricata");
    
    // Avvia il server e carica i dati
    await setupServerLifecycle();
    await loadPdfData();
});

// Quando l'utente chiude la pagina
window.addEventListener('beforeunload', async function() {
    console.log("ðŸ‘‹ Chiusura pagina");
    await cleanupServer();
});

// Funzione di startup
async function setupServerLifecycle() {
    const statusEl = document.getElementById('status');
    statusEl.textContent = "ðŸ”„ Avvio server PDF...";
    
    const started = await window.APIConfig.ensurePdfServerRunning();
    
    if (started) {
        statusEl.textContent = "âœ… Server pronto";
        serverReady = true;
    } else {
        statusEl.textContent = "âŒ Errore avvio server";
        serverReady = false;
    }
}

// Funzione di cleanup
async function cleanupServer() {
    try {
        await fetch("http://localhost:3000/api/stop-pdf-server", {
            method: "POST",
            keepalive: true  // Importante per richieste durante beforeunload
        });
    } catch {
        // Silent fail - il browser sta chiudendo comunque
    }
}
</script>
```

### 4. **pdf-server.js** (TIER 3)

File: `C:\VSC_Live_Server\pdf-server.js`

**ResponsabilitÃ :**
- Servire la lista di PDF
- Aprire PDF in Chrome
- Chiudere Chrome

**Nota:** Non necessita modifiche. Server Manager lo spawna automaticamente con:
```javascript
spawn('node', ['pdf-server.js'], { stdio: 'inherit' })
```

---

## ðŸ” Risoluzione Problemi

### Problema: "Errore: PDF Server non si avvia"

**Cause possibili:**

1. **Node.js non installato**
   ```powershell
   # Verifica
   node --version
   npm --version
   
   # Se non appare, installa da: https://nodejs.org
   ```

2. **Porta 3000 giÃ  occupata**
   ```powershell
   # Verifica cosa occupa la porta
   Get-NetTCPConnection -LocalPort 3000 | Select-Object -First 1
   
   # Uccidi il processo
   Get-Process | Where-Object {$_.Id -eq <PID>} | Stop-Process -Force
   
   # O cambia porta in start-server-manager.ps1
   ```

3. **start-server-manager.ps1 non trovato**
   ```powershell
   # Verifica che il file esista
   Test-Path C:\VSC_Live_Server\start-server-manager.ps1
   
   # Se non esiste, ricreare il file
   ```

### Problema: "PDF Server non risponde"

**Diagnosi:**

```powershell
# Controlla se Server Manager Ã¨ in esecuzione
Get-Process -Name "node" | Where {$_.CommandLine -match "server-manager"}

# Se non si vede, riavvia:
.\start-server-manager.ps1

# Controlla se la porta 3000 Ã¨ aperta
Test-NetConnection -ComputerName localhost -Port 3000

# Debug nel browser:
# Apri F12 â†’ Console â†’ Vedi i log della pagina
```

### Problema: "La pagina non carica i PDF"

**Debug steps:**

1. **Apri browser DevTools (F12)**
   - Vai su Console
   - Cerca messaggi di errore

2. **Verifica che C:\SCRIPT_PDF esista**
   ```powershell
   Test-Path C:\SCRIPT_PDF
   ls C:\SCRIPT_PDF | Format-Table
   ```

3. **Testa manualmente l'endpoint**
   ```powershell
   # In PowerShell
   Invoke-WebRequest -Uri "http://localhost:8765/api/pdf-list"
   ```

4. **Se il Server Manager Ã¨ strano, riavvia tutto**
   ```powershell
   # Ferma tutto
   .\stop-server-manager.ps1
   Get-Process -Name "node" | Stop-Process -Force
   
   # Attendi 2 secondi
   Start-Sleep -Seconds 2
   
   # Riavvia
   .\start-server-manager.ps1
   ```

---

## ðŸ“¡ API Reference

### Server Manager API (porta 3000)

#### `POST /api/start-pdf-server`

**Request:**
```
POST http://localhost:3000/api/start-pdf-server
```

**Response (Success):**
```json
{
  "success": true,
  "message": "PDF Server avviato",
  "port": 8765,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Response (Already Running):**
```json
{
  "success": true,
  "message": "PDF Server giÃ  in esecuzione",
  "port": 8765,
  "pid": 12345
}
```

#### `POST /api/stop-pdf-server`

**Request:**
```
POST http://localhost:3000/api/stop-pdf-server
```

**Response:**
```json
{
  "success": true,
  "message": "PDF Server fermato",
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

#### `GET /api/status`

**Request:**
```
GET http://localhost:3000/api/status
```

**Response:**
```json
{
  "isRunning": true,
  "port": 8765,
  "pid": 12345,
  "uptime": 300000,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### PDF Server API (porta 8765)

#### `GET /api/pdf-list`

**Request:**
```
GET http://localhost:8765/api/pdf-list
```

**Response:**
```json
{
  "count": 3,
  "files": [
    {
      "name": "documento1.pdf",
      "fullPath": "C:\\SCRIPT_PDF\\documento1.pdf"
    },
    {
      "name": "documento2.pdf",
      "fullPath": "C:\\SCRIPT_PDF\\documento2.pdf"
    }
  ]
}
```

#### `POST /api/open-pdf`

**Request:**
```
POST http://localhost:8765/api/open-pdf
Content-Type: application/json

{
  "filePath": "C:\\SCRIPT_PDF\\documento1.pdf"
}
```

**Response:**
```json
{
  "success": true,
  "message": "PDF aperto in Chrome"
}
```

#### `POST /api/close-chrome`

**Request:**
```
POST http://localhost:8765/api/close-chrome
```

**Response:**
```json
{
  "success": true,
  "message": "Chrome chiuso"
}
```

---

## ðŸ“š File Involved

| File | Tipo | Descrizione |
|------|------|-------------|
| `server-manager.js` | Node.js | Manager process (porta 3000) |
| `api-config.js` | JavaScript | Client-side utility per auto-start |
| `Prova/ScriptPDF1.html` | HTML | Interfaccia utente con lifecycle |
| `pdf-server.js` | Node.js | Server PDF (porta 8765) |
| `start-server-manager.ps1` | PowerShell | Avvia Server Manager |
| `stop-server-manager.ps1` | PowerShell | Ferma Server Manager |
| `launch-all.ps1` | PowerShell | Avvia tutto insieme |

---

## ðŸŽ¯ Checklist di Verifica

- [ ] Node.js v14+ installato (`node --version`)
- [ ] npm installato (`npm --version`)
- [ ] `start-server-manager.ps1` esiste e Ã¨ eseguibile
- [ ] `api-config.js` Ã¨ nella cartella root
- [ ] `ScriptPDF1.html` ha `<script src="/api-config.js"></script>`
- [ ] C:\SCRIPT_PDF esiste e contiene PDF
- [ ] Browser DevTools F12 non mostra errori di rete
- [ ] Porta 3000 Ã¨ disponibile
- [ ] Porta 8765 Ã¨ disponibile
- [ ] Porta 5500 Ã¨ disponibile (Live Server)

---

## ðŸ“ž Support

Se hai problemi:

1. **Controlla i log**
   - Console del browser (F12)
   - Finestra PowerShell del Server Manager

2. **Verifica lo stato**
   ```powershell
   Get-Process -Name "node"
   Test-NetConnection -ComputerName localhost -Port 3000
   Test-NetConnection -ComputerName localhost -Port 8765
   ```

3. **Riavvia tutto**
   ```powershell
   .\stop-server-manager.ps1
   Start-Sleep -Seconds 2
   .\start-server-manager.ps1
   ```

4. **Controlla i file**
   - Assicurati che `server-manager.js` esista
   - Assicurati che `api-config.js` esista
   - Assicurati che `ScriptPDF1.html` includa api-config.js

---

## Migrazione all'Architettura Unificata

**Questa architettura è stata sostituita dal unified-server.js su porta 5500.**

### Per Migrare il Codice

Se hai script o configurazioni che usano le porte legacy:

1. **3000** → Sostituisci con chiamate dirette a `http://localhost:5500/api/pdf-*`
2. **8765** → Stesso endpoint, ora su 5500
3. **3010** → Sostituisci con `http://localhost:5500/api/eventi/*`

### File Legacy Mantenuti

I seguenti file sono mantenuti per compatibilità ma non sono più nel flusso standard:

- `server-manager.js` (porta 3000)
- `pdf-server.js` (porta 8765) 
- `server-eventi.js` (porta 3010)
- Script di avvio separati per server multipli

### Documentazione Attuale

- [README.md](README.md) - Guida al unified server
- [QUICK_START.md](QUICK_START.md) - Avvio rapido
- [pdf/README.md](pdf/README.md) - Sistema PDF integrato

---

**Versione:** 1.0 (Legacy)  
**Data:** 2024  
**Ultimo aggiornamento:** 2024  
**Stato:** Deprecato - Vedi unified-server.js  


