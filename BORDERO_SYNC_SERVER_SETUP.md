# 🚀 BORDERO SYNC SERVER - Setup & Usage

## Cosa Fa

Il **Sync Server** è un server Node.js che riceve i dati Excel dal browser e li sincronizza direttamente nei file CSV su disco.

### Flow:
```
Excel File → Browser (XLSX.js) → localStorage → Sync Server (Node.js) → CSV Files on Disk
```

---

## 📋 Prerequisiti

- **Node.js** (v14+)
- **npm** installato
- **express** package (già nel progetto)

---

## 🔧 Setup Iniziale

### Passo 1: Verifica i prerequisiti
```bash
node --version
npm --version
```

### Passo 2: Installa dipendenze (se non fatto)
```bash
cd C:\VSC_Live_Server - WEB.worktrees\agents-bordero-html-css-js-conversion
npm install express
```

---

## ▶️ Come Avviare il Server

### Opzione 1: Manuale (PowerShell)

```powershell
# Nel terminale di VS Code o PowerShell
cd 'C:\VSC_Live_Server - WEB.worktrees\agents-bordero-html-css-js-conversion'
node Bordero/server/sync-server.js
```

Dovresti vedere:
```
╔═══════════════════════════════════════════════╗
║  🚀 BORDERO SYNC SERVER                      ║
║  Porta: 5501                                  ║
║  Data Dir: Bordero\data                       ║
║                                               ║
║  Endpoint disponibili:                        ║
║  POST /api/sync/brani                         ║
║  POST /api/sync/comuni                        ║
║  POST /api/sync/dbase                         ║
║  GET  /api/status                             ║
╚═══════════════════════════════════════════════╝
```

### Opzione 2: Con npm script (consigliato)

Aggiungi a `package.json`:

```json
{
  "scripts": {
    "sync-server": "node Bordero/server/sync-server.js",
    "start": "node Bordero/server/sync-server.js"
  }
}
```

Poi avvia con:
```bash
npm run sync-server
```

---

## 🧪 Test del Server

### Verifica che sia online

Apri il browser e vai a:
```
http://localhost:5501/api/status
```

Dovresti vedere un JSON con lo stato del server:
```json
{
  "server": "Bordero Sync Server",
  "port": 5501,
  "status": "online",
  "dataDir": "C:\\...\\Bordero\\data",
  "files": {
    "brani": { "exists": false, "path": "..." },
    "comuni": { "exists": false, "path": "..." },
    "dbase": { "exists": false, "path": "..." }
  }
}
```

---

## 💾 Sincronizzare i Dati

### Da Admin Panel nel Browser

1. **Avvia il sync server** (vedi sopra)
2. **Apri Admin Panel:** http://localhost:8000/Bordero/pages/admin.html
3. **Seleziona il file Excel:** Clicca "📁 Seleziona File Excel..."
4. **Sincronizza:** Clicca "🔄 Sincronizza Tutto da Excel"

### Cosa Succede Automaticamente:

1. ✅ Browser legge il file Excel (XLSX.js)
2. ✅ Salva i dati in `localStorage`
3. ✅ Invia i dati al Sync Server via POST /api/sync/brani
4. ✅ Il server scrive il file `Bordero/data/brani.csv` su disco
5. ✅ Toast verde: "✅ 120 brani sincronizzati su disco"

### Verifica il Risultato

Controlla che i file CSV siano stati creati:
```bash
ls -la Bordero/data/
```

Dovresti vedere:
```
brani.csv       (120 righe + header)
comuni_italia.csv (8 righe + header)
dBase.csv       (5 righe + header)
```

---

## 🐛 Troubleshooting

### Errore: "Porta 5501 in uso"

Se la porta 5501 è occupata, cambia porta:
```bash
set BORDERO_SYNC_PORT=5502
node Bordero/server/sync-server.js
```

Poi aggiorna excel-sync.js linea ~390:
```javascript
const SYNC_SERVER = 'http://localhost:5502';
```

### Errore: "Express non trovato"

Installa Express:
```bash
npm install express
```

### Nessun file CSV creato

1. Verifica che il server sia online: http://localhost:5501/api/status
2. Controlla la console del server per errori
3. Assicurati di avere i permessi di scrittura su Bordero/data/

### I dati non vengono letti dal foglio Excel

1. Apri la console del browser (F12)
2. Guarda i log durante la sincronizzazione
3. Verifica il nome del foglio Excel ("Elenco Brani (statico)", "Comuni Italia", "dBase")

---

## 📊 API Endpoints

### POST /api/sync/brani
Sincronizza il foglio "Elenco Brani (statico)" → `brani.csv`

**Request:**
```json
{
  "data": [
    { "id": 1, "titolo": "Brano 1", "autore": "Autore 1", ... },
    { "id": 2, "titolo": "Brano 2", "autore": "Autore 2", ... }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "✅ 120 brani sincronizzati",
  "file": "Bordero/data/brani.csv",
  "rows": 120,
  "timestamp": "2026-06-18T17:54:00.000Z"
}
```

### POST /api/sync/comuni
Sincronizza il foglio "Comuni Italia" → `comuni_italia.csv`

### POST /api/sync/dbase
Sincronizza il foglio "dBase" → `dBase.csv`

### GET /api/status
Ritorna lo stato del server e dei file

---

## 🔄 Auto-Start del Server (Opzionale)

Se vuoi che il server si avvii automaticamente:

### Windows: Crea batch file
Salva come `start-sync-server.bat`:
```batch
@echo off
cd /d "C:\VSC_Live_Server - WEB.worktrees\agents-bordero-html-css-js-conversion"
node Bordero/server/sync-server.js
pause
```

Doppio-click per avviare.

### PowerShell: Script
Salva come `start-sync-server.ps1`:
```powershell
cd 'C:\VSC_Live_Server - WEB.worktrees\agents-bordero-html-css-js-conversion'
node Bordero/server/sync-server.js
```

---

## ✅ Checklist Completo

- [ ] Node.js installato
- [ ] Express package disponibile (`npm install express`)
- [ ] Sync Server avviato (`node Bordero/server/sync-server.js`)
- [ ] Server online (http://localhost:5501/api/status)
- [ ] Browser su Admin Panel (http://localhost:8000/Bordero/pages/admin.html)
- [ ] File Excel selezionato
- [ ] Sincronizzazione completata
- [ ] File CSV creati in Bordero/data/

---

## 📁 File Coinvolti

```
Bordero/
├── server/
│   └── sync-server.js           ← Server Node.js
├── js/
│   ├── excel-sync.js             ← Modifica: aggiunto syncToDisk()
│   └── ...
├── data/
│   ├── brani.csv                 ← Generato
│   ├── comuni_italia.csv         ← Generato
│   └── dBase.csv                 ← Generato
└── pages/
    └── admin.html                ← Admin Panel
```

---

## 🎯 Prossimi Step

1. ✅ Avvia il Sync Server
2. ✅ Sincronizza i dati da Excel
3. ✅ Verifica che i CSV siano popolati
4. ✅ Testa la visualizzazione dei dati in bordero.html

---

**Nota:** Il Sync Server deve rimanere in esecuzione per tutta la durata del lavoro con Bordero. Se lo chiudi, il browser non potrà più sincronizzare i dati su disco.
