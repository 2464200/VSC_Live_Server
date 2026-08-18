# 🚀 MONSTER COUNTRY DJ - Guida Avvio Rapido

**Data creazione:** 2026-08-18  
**Stato:** ✅ Portabile e testato su clone

---

## Avvio Rapido (30 secondi)

### Opzione 1: Double-click (Consigliato)
```
START-UNATTENDED.bat
```
Il server si avvierà automaticamente sulla prima porta disponibile (5500, 5501, 5502, ...).

### Opzione 2: PowerShell (Avanzato)
```powershell
cd C:\VSC_Live_Server
.\scripts\start-unattended.ps1
```

### Opzione 3: npm script
```bash
npm run start:portable
```

---

## Diagnostica Rapida

Se il server non si avvia:

```powershell
cd C:\VSC_Live_Server
.\scripts\diagnostic-report.ps1
```

Questo mostrerà:
- ✅/❌ Stato di Node.js, npm, Git, Firebase
- ✅/❌ Cartelle progetto
- ✅/❌ Disponibilità porta

---

## Comportamento Portabile

### Primo Avvio
1. **Crea `.env`** da `.env.example` (se non esiste)
2. **Crea cartelle** (logs/, pids/, config/, etc.)
3. **npm install** se `node_modules/` manca
4. **Sceglie porta** automaticamente (5500 è fallback a 5501, 5502, ... se occupate)
5. **Lancia server** senza interazione
6. **Opzionale:** Apre browser

### Comportamento Porte
- Porta predefinita: `5500` (configurabile in `.env`)
- Se occupata: prova 5501, 5502, 5503... fino a 5519
- Fallback garantito su una porta libera

### Comportamento Cartelle
- **Relative al progetto** (non dipende da `C:\VSC_*`)
- Config centrale: `config/config.js`
- Variabili ambiente: `.env` e `.env.example`

---

## Configurazione

### File `.env` (opzionale, creato automaticamente)
```env
UNIFIED_PORT=5500
VSC_SCRIPT_PDF_DIR=./exports/pdfs
VSC_VIDEOCLIP_PATH=./exports/videoclips
VSC_SIAE_DIR=./exports/siae
USERFORM_RECORDINGS_DIR=./exports/recordings
```

### Localizzazioni Disponibili
- **Windows**: Automatico tramite `$env:USERNAME`, `$env:ProgramFiles`
- **Rete**: Auto-detect IP locale nel log
- **Lingue**: Ita, Eng (fallback Ita)

---

## Verificare il Funzionamento

### Log
```
logs/server-portable.log       # Output del server
logs/server-portable.err.log   # Errori
logs/clone-test.log            # Ultimo test clone
```

### URL Locali (dopo l'avvio)
- **Web:** `http://localhost:5500/`
- **PDF API:** `http://localhost:5500/api/pdf-list`
- **Eventi:** `http://localhost:5500/eventi/`
- **Bordero:** `http://localhost:5500/Bordero/`

### Rete (da altro PC sulla LAN)
Vedi l'output del server per l'IP:
```
📍 Rete: http://192.168.x.x:5500
```

---

## Roadmap Completata ✅

### FASE 1: Portabilità (✅ COMPLETATA)
- ✅ Centralizzato config (`config/config.js`)
- ✅ Rimossi riferimenti hard-coded PC locale
- ✅ Auto-creazione cartelle e `.env`
- ✅ Port fallback intelligente

### FASE 2: Avvio Automatico (✅ COMPLETATA)
- ✅ Launcher non-interattivo (`start-unattended.ps1`)
- ✅ Script diagnostica (`diagnostic-report.ps1`)
- ✅ Batch launcher per Windows (`START-UNATTENDED.bat`)
- ✅ npm script integrato (`npm run start:portable`)

### FASE 3: Validazione PC Pulito (✅ COMPLETATA)
- ✅ Clone test eseguito: **SUCCESSO**
  - npm install: ✅
  - Server startup: ✅ (porta 5505)
  - HTTP response: ✅ (status 200)

### FASE 4: Documentazione (✅ IN CORSO)
- ✅ Guida avvio (questo file)
- ⏳ Distribuibile (prossimo)

---

## Troubleshooting

### "Porta occupata"
→ Normale, il launcher sceglierà automaticamente la prossima disponibile (vedi log)

### "npm install fallito"
→ Controlla `logs/clone-test.log`

### "Server non risponde"
→ Esegui `diagnostic-report.ps1`

### "node_modules corrotto"
→ Cancella `node_modules/` e `.package-lock.json`, poi `npm install`

---

## Prossimi Passi (FASE 4: Distribuibile)

Per pacchetto standalone Electron o installer:
1. Creare `.app` o `.exe` wrapper
2. Includere Node.js embedded (opzionale)
3. Auto-update e self-healing

---

**Documentazione:** [README_PORTABILITY.md](README_PORTABILITY.md)  
**Problemi?** Esegui: `.\scripts\diagnostic-report.ps1`
