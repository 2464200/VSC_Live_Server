# VSC Live Server — Guida unificata del progetto

Questa è la guida principale per il progetto **VSC Live Server**, che include la soluzione completo per la sincronizzazione Google Sheets / CSV, il frontend Borderò e il sistema Eventi.

## Indice

- [Overview](#overview)
- [Architettura progetto](#architettura-progetto)
- [Server e pagine principali](#server-e-pagine-principali)
- [Bordero e sincronizzazione CSV](#bordero-e-sincronizzazione-csv)
- [Eventi e pagine collegate](#eventi-e-pagine-collegate)
- [Documentazione completa](#documentazione-completa)
- [Link rapidi ai file](#link-rapidi-ai-file)
- [Uso operativo](#uso-operativo)
- [Aggiornamenti recenti (2026-07)](#aggiornamenti-recenti-2026-07)
- [Git e versionamento](#git-e-versionamento)
- [Note aggiuntive](#note-aggiuntive)

## Overview

Il progetto si basa su un unico punto di riferimento per la documentazione: questo file `README.md` nella radice del repository. Qui trovi le indicazioni per l'intera soluzione e i link per navigare nelle singole sezioni.

## Architettura progetto

- Root repository locale: `C:\VSC_Live_Server`
- `Bordero/`: applicazione DJ Manager basata su HTML/CSS/JS e sincronizzazione CSV/Google Sheets.
- `Eventi/`: modulo Eventi, con pagine web per gestione eventi, visualizer e API.
- `server/`: server di sincronizzazione e setup backend per Bordero.
- `pdf/`: documentazione e risorse PDF.

## Server e pagine principali

Il flusso standard utilizza ora un singolo server unificato o, in caso di test locali, un server statico semplice.

- Portale principale: `http://localhost:5500/index.html`
- Borderò locale statico: `http://localhost:5501/Bordero/pages/bordero.html` (test)
- API sync Borderò: `http://localhost:5501/api/status` se il server di sync è avviato sulla porta `5501` o `5500` a seconda della configurazione.

## Bordero e sincronizzazione CSV

La cartella `Bordero/` contiene:

- `Bordero/pages/`: le pagine HTML principali come `bordero.html`, `display.html`, `next-coreo.html`, `videoclip.html`, `lista-serata.html`, `risultati.html`.
- `Bordero/js/`: logica JavaScript per caricamento CSV, filtro, ordinamento, sincronizzazione e UX.
- `Bordero/data/`: file CSV locali come `brani.csv`, `comuni_italia.csv`, `dBase.csv`.
- `Bordero/server/google-sheets-sync.js`: script per sincronizzare i CSV da Google Sheets.

## Eventi e pagine collegate

La cartella `Eventi/` contiene la documentazione e i file per il modulo Eventi.

- `Eventi/README_EVENTI.md`: documentazione principale per Eventi.
- `Eventi/DOCUMENTATION*.md`: documenti specifici per amministrazione, sviluppo e operazioni.
- `Eventi/FLUSSO_LOGICO_DEFINITIVO.md`: dettaglio del flusso definitivo.

## Documentazione completa

### Documenti principali della radice

- [GUIDA_USO_PROGETTO.md](GUIDA_USO_PROGETTO.md)
- [GUIDA_SELEZIONE_EXCEL.md](GUIDA_SELEZIONE_EXCEL.md)
- [GUIDA_GIT_MAIN_DEVELOP.md](GUIDA_GIT_MAIN_DEVELOP.md)
- [QUICK_START_GUIDE.md](QUICK_START_GUIDE.md)
- [QUICK_START.md](QUICK_START.md)
- [WORKFLOW_AUTOMATICO_README.md](WORKFLOW_AUTOMATICO_README.md)
- [README_SERVER_MANAGER.md](README_SERVER_MANAGER.md)
- [README_SETUP_STABILE.md](README_SETUP_STABILE.md)
- [README_BORDERÒ.md](README_BORDERÒ.md)
- [README_PDF_FIXES.md](README_PDF_FIXES.md)
- [README_ScriptPDF1.md](README_ScriptPDF1.md)
- [README_SOLUZIONE_DINAMICA.md](README_SOLUZIONE_DINAMICA.md)
- [PROJECT_COMPLETE.md](PROJECT_COMPLETE.md)
- [PROJECT_STATUS.md](PROJECT_STATUS.md)
- [FINAL_SOLUTION.md](FINAL_SOLUTION.md)
- [SOLUZIONE_DEFINITIVA.md](SOLUZIONE_DEFINITIVA.md)
- [SOLUTION_SUMMARY.md](SOLUTION_SUMMARY.md)
- [CHANGELOG.md](CHANGELOG.md)
- [AUTOMAZIONE_COMPLETA.md](AUTOMAZIONE_COMPLETA.md)
- [FIX_COMPLETE_SUMMARY.md](FIX_COMPLETE_SUMMARY.md)
- [FIX_ROBUSTNESS.md](FIX_ROBUSTNESS.md)
- [DEBUG_EXCEL_SYNC.md](DEBUG_EXCEL_SYNC.md)
- [EVENTI_SERVER_SETUP.md](EVENTI_SERVER_SETUP.md)
- [BORDERO_SYNC_SERVER_SETUP.md](BORDERO_SYNC_SERVER_SETUP.md)
- [BORDERO_COMPLETION_STATUS.md](BORDERO_COMPLETION_STATUS.md)
- [GITHUB_COMMIT_SUMMARY.md](GITHUB_COMMIT_SUMMARY.md)
- [CONSOLE_TEST_SCRIPT.md](CONSOLE_TEST_SCRIPT.md)
- [INTEGRITY_CHECK_20260409.md](INTEGRITY_CHECK_20260409.md)
- [HAI_RICEVUTO.md](HAI_RICEVUTO.md)

### Documenti Bordero

- [Bordero/README.md](Bordero/README.md)
- [Bordero/GOOGLE_SHEETS_API_SETUP.md](Bordero/GOOGLE_SHEETS_API_SETUP.md)
- [Bordero/PROJECT_COMPLETION_REPORT.md](Bordero/PROJECT_COMPLETION_REPORT.md)
- [Bordero/PROJECT_STATUS.md](Bordero/PROJECT_STATUS.md)

### Documenti Eventi

- [Eventi/README_EVENTI.md](Eventi/README_EVENTI.md)
- [Eventi/DOCUMENTATION.md](Eventi/DOCUMENTATION.md)
- [Eventi/DOCUMENTATION_ADMIN.md](Eventi/DOCUMENTATION_ADMIN.md)
- [Eventi/DOCUMENTATION_DEVELOPMENT.md](Eventi/DOCUMENTATION_DEVELOPMENT.md)
- [Eventi/DOCUMENTATION_OPERATIONS.md](Eventi/DOCUMENTATION_OPERATIONS.md)
- [Eventi/FLUSSO_LOGICO_DEFINITIVO.md](Eventi/FLUSSO_LOGICO_DEFINITIVO.md)
- [Eventi/RISOLUZIONE_PROBLEMA_CONTAINER.md](Eventi/RISOLUZIONE_PROBLEMA_CONTAINER.md)
- [Eventi/CORREZIONE_FLUSSO_STATI.md](Eventi/CORREZIONE_FLUSSO_STATI.md)
- [Eventi/VERIFICA_NUOVE_FUNZIONALITA.md](Eventi/VERIFICA_NUOVE_FUNZIONALITA.md)
- [Eventi/archive/README_EVENTI.md](Eventi/archive/README_EVENTI.md)
- [Eventi/archive/FLUSSO_LOGICO_DEFINITIVO.md](Eventi/archive/FLUSSO_LOGICO_DEFINITIVO.md)
- [Eventi/archive/RISOLUZIONE_PROBLEMA_CONTAINER.md](Eventi/archive/RISOLUZIONE_PROBLEMA_CONTAINER.md)
- [Eventi/archive/CORREZIONE_FLUSSO_STATI.md](Eventi/archive/CORREZIONE_FLUSSO_STATI.md)

### Altri documenti

- [pdf/README.md](pdf/README.md)

## Link rapidi ai file

- [Bordero/pages/bordero.html](Bordero/pages/bordero.html)
- [Bordero/js/data-loader.js](Bordero/js/data-loader.js)
- [Bordero/js/config.js](Bordero/js/config.js)
- [Bordero/server/google-sheets-sync.js](Bordero/server/google-sheets-sync.js)
- [Bordero/data/brani.csv](Bordero/data/brani.csv)
- [Eventi/eventi/eventi.html](Eventi/eventi/eventi.html)

## Uso operativo

### Avvio principale

1. Apri il progetto in VS Code.
2. Se stai usando il server unificato, avvia `node unified-server.js` dalla radice.
3. Se stai usando il server Bordero statico per test, avvia un server HTTP locale nella cartella `Bordero`.

### URL utili

- Home: `http://localhost:5500/index.html`
- Borderò: `http://localhost:5500/Bordero/pages/bordero.html`
- Eventi: `http://localhost:5500/eventi/eventi.html`

## Aggiornamenti recenti (2026-07)

Questa sezione riassume le modifiche funzionali principali applicate nelle ultime iterazioni.

### VLC e VideoClip (`Bordero/pages/videoclip.html`, `Bordero/pages/videoclip.js`, `unified-server.js`)

- Avvio VLC reso esclusivo: a ogni nuovo `PLAY` resta attivo solo l'ultimo video selezionato.
- Migliorata la gestione comandi VLC (`PLAY`, `PAUSA`, `FERMA`) tramite endpoint `POST /api/videoclip/vlc/control`.
- Aggiunto `--no-video-title-show` all'avvio VLC per non mostrare il nome file in sovraimpressione.
- Rafforzata la chiusura VLC in `stop` con fallback di terminazione processo quando necessario.
- Migliorata la coerenza UI tra player HTML5 principale e controllo monitor secondario.
- In `videoclip`: click su `SELEZIONA` card con scroll automatico in alto al player.

### Match libreria video (`Bordero/pages/videoclip.js`)

- Refactoring del match brano-file video con catalogo normalizzato e scoring.
- Priorità al prefisso ID (`NNN`) e disambiguazione più severa.
- Nei casi ambigui il sistema evita il match errato (preferisce non associare).

### Tabella Borderò e ordinamento colonne (`Bordero/pages/bordero.html`, `Bordero/pages/bordero.js`, `Bordero/pages/bordero.css`)

- Intestazioni colonna rese cliccabili come tasti di ordinamento.
- Regola ordinamento intestazioni:
	- primo click sulla colonna: crescente
	- click successivi sulla stessa colonna: alternanza crescente/decrescente
	- click su nuova colonna: reset del criterio precedente e nuovo crescente.
- Inserito box rapido `RESET FILTRI + ID ↑` nella barra statistiche.
- Aggiunto indicatore stato `Eseguiti in fondo: ON/OFF`.
- Modalità `SPOSTA IN FONDO GLI ESEGUITI` mantenuta anche con riordino: gli eseguiti restano in fondo ma vengono ordinati internamente quando si applica un sort.

### Comandi filtri e popup selezione valori (`Bordero/pages/bordero.html`, `Bordero/pages/bordero.js`, `Bordero/pages/bordero.css`)

- Aggiornati i 4 tasti filtro:
	- `LIVELLO` (campo `info_livello`)
	- `GENERE` (campo `genere`)
	- `COREOGRAFO` (campo `coreografo`)
	- `AUTORE` (campo `autore`)
- Ogni tasto apre popup con elenco valori unici della colonna corrispondente.
- Selezione valore nel popup: applica filtro e chiude popup immediatamente.
- Doppio click sul tasto filtro: reset solo del filtro di quel tasto (`nessun filtro`).
- Filtro popup con confronto esatto del valore (es. `AVANZATO 1` diverso da `SUPERAVANZATO 1`).

## Git e versionamento

Per il flusso completo con `main` e `develop` usa:
- [GUIDA_GIT_MAIN_DEVELOP.md](GUIDA_GIT_MAIN_DEVELOP.md)

Sintesi operativa minima:

```powershell
# 1) Aggiorna riferimenti remoti
git fetch --all --prune

# 2) Allinea develop locale
git checkout develop
git pull origin develop

# 3) Sviluppa su feature branch
git checkout -b feature/nome-attivita
git add -A
git commit -m "feat: descrizione breve"
git push -u origin feature/nome-attivita
```

Promozione finale:
- feature -> develop (merge testato)
- develop -> main (preferibilmente via Pull Request)

## Note aggiuntive

- Questo file è la guida unica per il progetto. Tutti i documenti `.md` collegati sono elencati nella sezione [Documentazione completa](#documentazione-completa).
- Se modifichi altri file di documentazione, aggiorna qui i link principali.
