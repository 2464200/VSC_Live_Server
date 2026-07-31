# ðŸš€ BORDERO SYNC SERVER - Setup & Usage

> ðŸ“Œ Questa documentazione fa parte della [guida unificata del progetto](README.md).


## Cosa Fa

Il **Sync Server** Ã¨ un server Node.js che riceve i dati Excel dal browser e li sincronizza direttamente nei file CSV su disco.

Nota runtime: il progetto completo usa come standard `unified-server.js` su `http://localhost:5500`.
Il Sync Server Bordero su `5501` resta un servizio dedicato solo alla sincronizzazione CSV.

### Flow:
```
Excel File â†’ Browser (XLSX.js) â†’ localStorage â†’ Sync Server (Node.js) â†’ CSV Files on Disk
```

---

## ðŸ“‹ Prerequisiti

- **Node.js** (v14+)
- **npm** installato
- **express** package (giÃ  nel progetto)

---

## ðŸ”§ Setup Iniziale

### Passo 1: Verifica i prerequisiti
```bash
node --version
npm --version
```

### Passo 2: Installa dipendenze (se non fatto)
```bash
cd C:\VSC_Live_Server
npm install express
```

---

## â–¶ï¸ Come Avviare il Server

### Opzione 1: Manuale (PowerShell)

```powershell
# Nel terminale di VS Code o PowerShell
cd 'C:\VSC_Live_Server'
node Bordero/server/sync-server.js
```

Dovresti vedere:
```
â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
â•‘  ðŸš€ BORDERO SYNC SERVER                      â•‘
â•‘  Porta: 5501                                  â•‘
â•‘  Data Dir: Bordero\data                       â•‘
â•‘                                               â•‘
â•‘  Endpoint disponibili:                        â•‘
â•‘  POST /api/sync/brani                         â•‘
â•‘  POST /api/sync/comuni                        â•‘
â•‘  POST /api/sync/dbase                         â•‘
â•‘  POST /api/sync/location                      â•‘
â•‘  POST /api/sync/location-options              â•‘
â•‘  POST /api/sync/google-sheets                 â•‘
â•‘  GET  /api/status                             â•‘
â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

## ðŸ§ª Test del Server

### Verifica che sia online

Apri il browser e vai a:
```
http://localhost:5500/api/health
```

Dovresti vedere un JSON con lo stato del server unificato:
```json
{
  "status": "ok",
  "server": "unified-server",
  "port": 5500
}
```

---

## ðŸ’¾ Sincronizzare i Dati

### Da Admin Panel nel Browser

1. **Avvia il sync server** (vedi sopra)
2. **Apri Admin Panel:** http://localhost:5500/Bordero/pages/admin.html
3. **Seleziona il file Excel:** Clicca "ðŸ“ Seleziona File Excel..."
  - Directory consigliata: `C:\VSC_Live_Server\Excel\`
4. **Sincronizza:** Clicca "ðŸ”„ Sincronizza Tutto da Excel"
5. **Oppure online:** Clicca "ðŸŒ Sync da Google Sheets"

### Cosa Succede Automaticamente:

1. âœ… Browser legge il file Excel (XLSX.js)
2. âœ… Salva i dati in `localStorage`
3. âœ… Invia i dati al Sync Server via POST /api/sync/brani
4. âœ… Il server scrive il file `Bordero/data/brani.csv` su disco
5. âœ… Toast verde: "âœ… 120 brani sincronizzati su disco"

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

## ðŸ› Troubleshooting

### Errore: "Porta 5500 in uso"

Se la porta 5500 è occupata, avvia il server con una porta alternativa tramite variabile d’ambiente:
```bash
set UNIFIED_PORT=5502
node unified-server.js
```

Poi aggiorna gli URL di accesso a `http://localhost:5502`.

### Errore: "Express non trovato"

Installa Express:
```bash
npm install express
```

### Nessun file CSV creato

1. Verifica che il server sia online: http://localhost:5500/api/health
2. Controlla la console del server per errori
3. Assicurati di avere i permessi di scrittura su Bordero/data/

### I dati non vengono letti dal foglio Excel

1. Apri la console del browser (F12)
2. Guarda i log durante la sincronizzazione
3. Verifica il nome del foglio Excel ("Elenco Brani (statico)", "Comuni Italia", "dBase")

---

## ðŸ“Š API Endpoints

### POST /api/sync/brani
Sincronizza il foglio "Elenco Brani (statico)" â†’ `brani.csv`

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
  "message": "âœ… 120 brani sincronizzati",
  "file": "Bordero/data/brani.csv",
  "rows": 120,
  "timestamp": "2026-06-18T17:54:00.000Z"
}
```

### POST /api/sync/comuni
Sincronizza il foglio "Comuni Italia" â†’ `comuni_italia.csv`

### POST /api/sync/dbase
Sincronizza il foglio "dBase" â†’ `dBase.csv`

### POST /api/sync/location
Sincronizza i dati Location â†’ `location.csv`

### POST /api/sync/location-options
Sincronizza le opzioni popup Location â†’ `location_popup_options.csv`

### POST /api/sync/google-sheets
Esegue sync server-side da Google Sheets e aggiorna i CSV in `Bordero/data/`

### GET /api/status
Ritorna lo stato del server e dei file

---

## ðŸ”„ Auto-Start del Server (Opzionale)

Se vuoi che il server si avvii automaticamente:

### Windows: Crea batch file
Salva come `start-sync-server.bat`:
```batch
@echo off
cd /d "C:\VSC_Live_Server"
node Bordero/server/sync-server.js
pause
```

Doppio-click per avviare.

### PowerShell: Script
Salva come `start-sync-server.ps1`:
```powershell
cd 'C:\VSC_Live_Server'
node Bordero/server/sync-server.js
```

---

## âœ… Checklist Completo

- [ ] Node.js installato
- [ ] Express package disponibile (`npm install express`)
- [ ] Sync Server avviato (`node Bordero/server/sync-server.js`)
- [ ] Server online (http://localhost:5501/api/status)
- [ ] Browser su Admin Panel (http://localhost:5500/Bordero/pages/admin.html)
- [ ] File Excel selezionato
- [ ] File selezionato da C:\VSC_Live_Server\Excel\
- [ ] Sincronizzazione completata
- [ ] File CSV creati in Bordero/data/

---

## Git (main/develop) per il Sync Server

Aggiorna locale da remoto prima di cambiare script o CSV:

```powershell
git fetch --all --prune
git checkout develop
git pull origin develop
```

Salva e pubblica:

```powershell
git add -A
git commit -m "docs: aggiornamento guida sync server"
git push
```

Per merge, pull request e promozione `develop -> main`: `GUIDA_GIT_MAIN_DEVELOP.md`.

---

## ðŸ“ File Coinvolti

```
Bordero/
â”œâ”€â”€ server/
â”‚   â””â”€â”€ sync-server.js           â† Server Node.js
â”œâ”€â”€ js/
â”‚   â”œâ”€â”€ excel-sync.js             â† Modifica: aggiunto syncToDisk()
â”‚   â””â”€â”€ ...
â”œâ”€â”€ data/
â”‚   â”œâ”€â”€ brani.csv                 â† Generato
â”‚   â”œâ”€â”€ comuni_italia.csv         â† Generato
â”‚   â””â”€â”€ dBase.csv                 â† Generato
â””â”€â”€ pages/
    â””â”€â”€ admin.html                â† Admin Panel
```

---

## ðŸŽ¯ Prossimi Step

1. âœ… Avvia il Sync Server
2. âœ… Sincronizza i dati da Excel
3. âœ… Verifica che i CSV siano popolati
4. âœ… Testa la visualizzazione dei dati in bordero.html

---

**Nota:** Il Sync Server deve rimanere in esecuzione per tutta la durata del lavoro con Bordero. Se lo chiudi, il browser non potrÃ  piÃ¹ sincronizzare i dati su disco.



