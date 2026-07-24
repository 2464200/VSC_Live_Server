> 📌 Questa documentazione fa parte della [guida unificata del progetto](README.md).

**⚠️ Nota importante:** a partire dal 13 Apr 2026 il flusso standard del progetto usa un unico unified-server.js su http://localhost:5500. Le architetture con server-manager.js, pdf-server.js, simple-server.js, static-server.js, pdf-server-simple.js e le porte 3000, 3010, 8765 sono ora legacy/historiche e non fanno parte del percorso standard.

# Automazione Completa

## Stato attuale
Il progetto usa il server unificato `unified-server.js` sulla porta `5500`.

Dentro questo processo sono integrati:
- frontend statico
- API PDF
- API Eventi

## Avvio automatico
Quando apri la cartella in VS Code:
1. parte `startup.ps1`
2. viene avviato `unified-server.js`
3. il PID viene salvato in `pids/startup-pids.json`

## Arresto automatico
Quando chiudi il progetto:
1. parte `shutdown.ps1`
2. viene terminato il server unificato
3. il file PID viene pulito

## URL principali
- `http://localhost:5500/index.html`
- `http://localhost:5500/diagnostica.html`
- `http://localhost:5500/Prova/ScriptPDF1.html`
- `http://localhost:5500/eventi/eventi.html`
- `http://localhost:5500/eventi/visualizer.html`

## Controlli manuali
```powershell
.\startup.ps1 -NoWait
.\shutdown.ps1
node test-system.js
```

## Git operativo (main/develop)

Prima di avviare o distribuire modifiche locali:

```powershell
git fetch --all --prune
git checkout develop
git pull origin develop
```

Commit e pubblicazione:

```powershell
git add -A
git commit -m "chore: aggiorna automazione/documentazione"
git push
```

Promozione in produzione:
- `feature/*` -> `develop`
- `develop` -> `main` dopo test e review
- guida completa: `GUIDA_GIT_MAIN_DEVELOP.md`

## Troubleshooting
### Se il sistema non parte
- verifica Node.js con `node --version`
- verifica che la porta `5500` sia libera
- esegui `node test-system.js`

### Se Eventi non risponde
- verifica `http://localhost:5500/eventi/api/ping`
- verifica `http://localhost:5500/eventi/eventi.html`

### Se PDF non risponde
- verifica `http://localhost:5500/api/pdf-list`

## Porte
Nel flusso standard serve solo:
- `5500`

Le vecchie porte `3000`, `3010` e `8765` sono legacy e non necessarie per l'uso normale del progetto.



