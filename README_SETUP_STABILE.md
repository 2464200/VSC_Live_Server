# 🚀 Configurazione Stabile e Funzionante - VSC Live Server

## 📋 Sommario delle correzioni applicate

Tutte le pagine HTML sono state aggiornate per funzionare in modo **stabile e affidabile** con i seguenti miglioramenti:

### ✅ Correzioni applicate:

1. **URL localhost → 127.0.0.1**
   - Tutti i fetch usano `http://127.0.0.1:8765` (PDF Server) o localhost senza porta per file locali
   - Aggiunto cache-busting con `?t=` + `Date.now()`

2. **Error handling migliorato**
   - Aggiunto timeout robusto (10s) su tutti i fetch
   - Retry automatico (2 tentativi) in caso di fallimento
   - Messaggi di errore chiari e descrittivi

3. **PDF Server configurabile**
   - `pdf-server.js` legge porta da env variable `PDF_SERVER_PORT` (default: 8765)
   - Supporto per avvio con script PowerShell

4. **Script PowerShell di auto-avvio/stop**
   - `start-pdf-server.ps1` - Avvia intelligentemente il server (con verifica di processo)
   - `stop-pdf-server.ps1` - Ferma il server in modo sicuro

5. **Utility.js helper globale**
   - `fetchWithTimeoutAndRetry()` - Fetch robusto con retry
   - `loadCSV()` - Carica CSV con skip di header
   - `isPdfServerAvailable()` - Verifica disponibilità server
   - `showNotification()` - Mostra notifiche eleganti
   - `initApp()` - Inizializzazione app con controlli

---

## 🎯 Come avviare tutto

### **Opzione 1: Avvia tutto da PowerShell (CONSIGLIATO)**

```powershell
# Apri PowerShell nella cartella del progetto
cd C:\VSC_Live_Server

# Avvia il PDF Server
powershell .\start-pdf-server.ps1

# In un'altra finestra PowerShell, avvia Live Server:
npx http-server -c-1  # oppure usa Live Server extension di VSCode
```

### **Opzione 2: Avvia via VSCode**

1. **Avvia Live Server** (se installato)
   - Clicca su "Go Live" in basso a destra
   - Apre http://127.0.0.1:5500

2. **Avvia il PDF Server** (in PowerShell integrato di VSCode)
   ```powershell
   .\start-pdf-server.ps1
   ```

3. **Apri le pagine**
   - Dashboard principale: `http://127.0.0.1:5500/index.html`
   - Gestione PDF: `http://127.0.0.1:5500/Prova/ScriptPDF1.html`
   - Servizio: `http://127.0.0.1:5500/servizio2.html`

### **Opzione 3: Avvio con npm**

Se nel `package.json` hai uno script `start`:

```bash
npm start
```

---

## 📁 File di dati CSV

**Importante**: Mantieni i file CSV con cache-busting:

- **display.csv** - Tabella principale (file nella root)
- **NextCoreo.csv** - Prossima coreografia (file nella root)
- **servizio.csv** - Servizio corrente (file nella root)

Tutti i file devono essere sia nella **cartella root** che in **public/** per il deploy.

---

## 🔧 Configurazione avanzata

### Cambiare porta del PDF Server

```powershell
# Avvia su porta 5500 (stesso di Live Server)
.\start-pdf-server.ps1 -UsePort5500

# Avvia su porta custom
$env:PDF_SERVER_PORT = 3000
node pdf-server.js
```

### Debug e logging

Nel `utility.js`, la configurazione:

```javascript
window.AppConfig = {
    FETCH_TIMEOUT: 10000,    // Timeout in ms
    FETCH_RETRIES: 2,        // Numero di retry
    DEBUG: true              // Set false per disabilitare logging
};
```

---

## 🛠️ Troubleshooting

### ❌ "Server non risponde"

1. **Verifica che il PDF Server sia avviato:**
   ```powershell
   Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*pdf-server*" }
   ```

2. **Se non c'è, avvialo:**
   ```powershell
   .\start-pdf-server.ps1
   ```

3. **Verifica che Live Server sia in esecuzione:**
   ```powershell
   Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*http-server*" }
   ```

### ❌ "Timeout" sui CSV

- Assicurati che `display.csv`, `NextCoreo.csv`, `servizio.csv` esistano nella cartella root
- Verifica con il comando: `Test-Path display.csv`

### ❌ "Port already in use"

```powershell
# Libera la porta 8765 (chiudi processi node)
.\stop-pdf-server.ps1

# Se rimane bloccata:
netstat -ano | findstr :8765
taskkill /PID <PID> /F
```

### ❌ "Chrome non si apre"

- Assicurati che Chrome sia installato
- Verifica che la cartella `C:\SCRIPT_PDF` esista e contenga PDF

---

## 📊 Architettura della soluzione

```
┌─────────────────────────────────────────┐
│        Client (Browser)                 │
│  - index.html (display.csv)             │
│  - servizio2.html (servizio.csv)        │
│  - ScriptPDF1.html (PDF Manager)        │
└────────────┬────────────────────────────┘
             │
        ┌────┴────┬────────────────┐
        │         │                │
        ▼         ▼                ▼
   ┌────────┐ ┌────────┐  ┌──────────────┐
   │ Files  │ │ Live   │  │ PDF Server   │
   │ CSV    │ │Server  │  │ (port 8765)  │
   │(local) │ │(5500)  │  ├──────────────┤
   └────────┘ └────────┘  │ - /api/list  │
                           │ - /api/open  │
                           │ - /api/close │
                           └──────────────┘
```

---

## 📝 Note importanti

- **Cache-busting**: Tutti i CSV hanno `?t=Date.now()` per evitare cache del browser
- **Porta 8765**: Riservata per il PDF Server (può essere cambiata con env variable)
- **Porta 5500**: Live Server di VSCode (standard)
- **Timeout**: 10 secondi su tutti i fetch, con retry automatico
- **BOM handling**: Tutti i CSV sono puliti da eventuali BOM (Byte Order Mark)

---

## ✅ Checklist di verifica

- [ ] Node.js installato (`node --version`)
- [ ] pdf-server.js avviato (`start-pdf-server.ps1`)
- [ ] Live Server avviato su porta 5500
- [ ] CSV files esistono nella cartella root
- [ ] Cartella `C:\SCRIPT_PDF` esiste (con PDF se usi ScriptPDF1.html)
- [ ] Browser console non mostra errori (F12)
- [ ] Pagine si caricano senza errori HTTP

---

## 🚀 Prossimi step

1. ✅ Avvia il server con: `.\start-pdf-server.ps1`
2. ✅ Apri: `http://127.0.0.1:5500/index.html`
3. ✅ Controlla console (F12 > Console) per eventuali errori
4. ✅ Verifica che i CSV si carichino correttamente
5. ✅ Se ScriptPDF1.html: verifica che le API rispondano

**Tutto stabile e funzionante! 🎉**
