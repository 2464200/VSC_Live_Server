**⚠️ Nota importante:** a partire dal 13 Apr 2026 il flusso standard del progetto usa un unico unified-server.js su http://localhost:5500. Le architetture con server-manager.js, pdf-server.js, simple-server.js, static-server.js, pdf-server-simple.js e le porte 3000, 3010, 8765 sono ora legacy/historiche e non fanno parte del percorso standard.

# âœ… CHANGELOG - Correzioni Applicate per StabilitÃ 
## Data: 2 Giugno 2026
## Stato: ✅ STABILE - Miglioramenti UI Prova/Image.html

### ✅ Enhancements Prova/Image.html

#### **Aggiunte**:
1. **Popup interattivo di selezione immagine** all'apertura della pagina
   - Permette di selezionare un'immagine personalizzata da caricare
   - Interfaccia pulita con overlay scuro con bordo arancio neon

2. **Drag & Drop funzionale**
   - Area drop con feedback visivo (hover con colore arancio)
   - Supporto per trascinamento diretto da Esplora risorse

3. **Anteprima immagine nel popup**
   - Mostra preview in tempo reale
   - Visualizza nome file e dimensione in KB
   - Aggiorna dinamicamente l'attributo `alt` con nome file selezionato

4. **Sistema di pulsanti color-coded**
   - Blu: azioni di selezione ("Seleziona immagine")
   - Verde: conferma ("Conferma")
   - Rosso: rimozione ("Rimuovi selezione")
   - Arancio: default ("Mantieni immagine predefinita")

5. **Validazione file**
   - Controllo tipo file (solo immagini supportate)
   - Messaggio di errore se file non valido
   - Pulsante "Conferma" disabilitato fino a selezione valida

6. **Pulsante "Cambia immagine"** in alto a destra
   - Consente riselezionare un'immagine dopo l'apertura
   - Stile verde coerente con "Conferma"

7. **Accessibilità migliorata**
   - Supporto tasto Escape per chiudere popup
   - Testo alt descrittivo per screen reader

#### **Risultato**:
✅ UX migliorata per selezione immagini
✅ Compatibilità mantenuta con stile originale (sfondo scuro, neon borders)
✅ No breaking changes
## Data: 23 Aprile 2026
## Stato: âœ… STABILE E FUNZIONANTE - Fix sincronizzazione brani + eliminazione coreografie aggiuntive

### âœ… Correzione sincronizzazione brani CSV

#### **Problema**: il conteggio totale era sceso da 559 a circa 58
- âŒ La sincronizzazione leggeva `display.csv`, che contiene solo un sottoinsieme operativo
- âŒ Il file completo `Eventi/Elenco_Brani_statico.csv` non veniva piu' usato come base

#### **Soluzione Applicata**: âœ…
1. **Ripristinata la sorgente principale corretta** in `Eventi/brani-utils.js`
   - `Elenco_Brani_statico.csv` torna ad essere il CSV base
   - `display.csv` resta solo come fallback legacy
2. **Allineato il parser** al formato del file completo
   - separatore `;`
   - indici colonna corretti per ID, coreografia, brano, autore
3. **Verifica eseguita**
   - `baseCount: 559`
   - `extraCount: 3`
   - `total: 562`

### âœ… Eliminazione coreografie aggiuntive

#### **Soluzione Applicata**: âœ…
1. **Aggiunto pulsante `Elimina`** in `Eventi/public/coreografie-aggiuntive.js`
2. **Aggiunta API dedicata**:
   - `POST /eventi/api/aggiuntive/delete`
   - `DELETE /eventi/api/aggiuntive/:id` come fallback
3. **Aggiornata utilita' backend** `deleteExtraBrano()` in `Eventi/brani-utils.js`
4. **Aggiornata documentazione** in `Eventi/README_EVENTI.md` e `Eventi/VERIFICA_NUOVE_FUNZIONALITA.md`

#### **Risultato**:
âœ… Sincronizzazione tornata ai conteggi corretti
âœ… Eliminazione coerente da lista e da `Coreografie_Aggiuntive.csv`
âœ… Compatibilita' mantenuta con flussi legacy

## Data: 9 Aprile 2026
## Stato: âœ… STABILE E FUNZIONANTE - Fix Modal Coreografie + Stabilizzazione PDF Server

## Data: 9 Aprile 2026
## Stato: âœ… STABILE E FUNZIONANTE - Fix Modal Coreografie + Stabilizzazione PDF Server + Verifica IntegritÃ 

### âœ… Verifica IntegritÃ  Progetto (9 Aprile 2026)

#### **Obiettivo**: Assicurare che i fix PDF non interrompessero il resto del progetto
- âœ… Analisi sistematica di tutti i moduli
- âœ… Ricerca di conflitti di porta/URL
- âœ… Verifica isolamento moduli
- âœ… Zero interferenze rilevate

#### **Problemi Trovati e Corretti**:
1. `ScriptPDF1_prova.html` - Usa ancora `localhost` âŒ â†’ âœ… Allineato a 127.0.0.1
2. `pdf-viewer.html` - Codice duplicato e conflittuale âŒ â†’ âœ… Pulito e consolidato
3. `/Prova/ScriptPDF1.html` - Non allineato âŒ â†’ âœ… Allineato a 127.0.0.1

#### **Risultato**:
âœ… Tutti i client PDF (4 file) utilizzano URL consistente: `http://127.0.0.1:8765`
âœ… Modulo Eventi completamente isolato su porta 5500
âœ… Nessun conflitto fra moduli
âœ… Backward compatibility garantita
âœ… Documentazione: `INTEGRITY_CHECK_20260409.md`

---

### ðŸ”§ Fix PDF Server (9 Aprile 2026)

#### **Problemi Identificati**: âŒ
- Endpoint `/api/health` mancante â†’ Server non poteva essere verificato
- Endpoint `/api/pdf-log-tail` mancante â†’ Log non visualizzabili
- URL inconsistenti: client usa `localhost`, server risponde su `127.0.0.1`
- Timeout 3s troppo breve â†’ False negatives su connessioni intermittenti
- No retry logic â†’ Fallimento su primo timeout

#### **Soluzioni Applicate**: âœ…
1. **Aggiunto `/api/health`** - Endpoint per verificare server alive
2. **Aggiunto `/api/pdf-log-tail`** - Sistema di logging interno del server
3. **Normalizzato tutti i client** a usare `127.0.0.1:8765` (non `localhost`)
4. **Implementato Timeout + Retry**:
   - Timeout aumentato da 3s a 8s (configurabile)
   - Retry logic con backoff esponenziale (500ms, 1000ms)
   - Max 2 tentativi per connessione intermittente
5. **Migliorato Error Handling**:
   - Differenziazione fra timeout e errori di rete
   - Logging dettagliato di ogni tentativo
   - Messaggi di errore descrittivi
6. **Aggiunto supporto ESC** in pdf-viewer.html per chiudere con tasto

#### **File Modificati**:
- âœ… `pdf-server.js` - Aggiunto `/api/health`, `/api/pdf-log-tail`, logging
- âœ… `ScriptPDF1.html` - URL 127.0.0.1, timeout 8s, retry logic
- âœ… `pdf-viewer.html` - URL 127.0.0.1, ESC handler, closePdfViewer()

#### **Risultato**:
âœ… Connessioni intermittenti supportate tramite retry
âœ… Timeout robusti e configurabili
âœ… Diagnostica server migliorata via `/api/health`
âœ… UX migliorata (ESC per chiudere viewer)
âœ… Documentazione: `README_PDF_FIXES.md`

---

### ðŸ”§ Fix Modal Coreografie Aggiuntive (9 Aprile 2026)

#### **Problema**: Modal di modifica si apriva automaticamente
- âŒ Modal visibile al caricamento della pagina
- âŒ Pulsanti X, Salva, Annulla non funzionali

#### **Soluzione Applicata**: âœ…
1. **Aggiunta regola CSS** in `Eventi/public/style.css`:
   ```css
   .modal[hidden] {
     display: none !important;
   }
   ```
   - Mancava la regola CSS per nascondere il modal quando ha attributo `hidden`

2. **Protezione listener duplicati** in `Eventi/public/coreografie-aggiuntive.js`:
   - Aggiunto flag `_listenerAttached` su ogni pulsante
   - Eseguita funzione `setupModalEventListeners()` una sola volta
   - Evita listener multipli che causavano malfunzionamento pulsanti

3. **Aggiunto controllo esplicito** in `renderCoreografieAggiuntive()`:
   - Assicura che il modal rimanga `hidden` al caricamento

#### **File Modificati**:
- âœ… `Eventi/public/style.css` - Aggiunta regola `.modal[hidden]`
- âœ… `Eventi/public/coreografie-aggiuntive.js` - Fix protezione listener
- âœ… `Eventi/public/coreografie-aggiuntive.html` - Commento chiarificatore
- âœ… `Eventi/README_EVENTI.md` - Documentazione aggiornata
- âœ… `Eventi/VERIFICA_NUOVE_FUNZIONALITA.md` - Documentazione aggiornata

#### **Risultato**:
âœ… Pagina carica mostrando SOLO l'elenco dei brani aggiuntivi
âœ… Modal rimane nascosto
âœ… Tutti i pulsanti (X, Salva, Annulla) funzionano perfettamente
âœ… Modifica si apre solo su richiesta utente (click "Modifica")

---

## Data: 4 Aprile 2026
## Stato: âœ… STABILE E FUNZIONANTE - Aggiornato con automazione completa

---

## ðŸ“ Sommario Correzioni

Tutte le pagine HTML e gli script sono stati rivisti e corretti per garantire **stabilitÃ  e funzionamento affidabile**. Aggiunta automazione completa per virtual environment e generazione dati.

### ðŸ”§ Problemi risolti (Aggiornati):

1. **URL localhost non stabili** â†’ Aggiornato a `127.0.0.1` con porta specifica
2. **Cache del browser causa errori** â†’ Aggiunto cache-busting `?t=Date.now()`
3. **Fetch senza timeout falliscono** â†’ Aggiunto timeout 10s con retry automatico
4. **PDF Server non sempre disponibile** â†’ Creati script PowerShell di auto-avvio/stop
5. **Errori non chiari agli utenti** â†’ Aggiunto error handling e messaggi descrittivi
6. **Nessun meccanismo di diagnostica** â†’ Creato file `diagnostica.html` per test automatici
7. **Virtual environment richiede attivazione manuale** â†’ Risolto con percorsi assoluti Python
8. **Generazione dati report non automatica** â†’ Integrata in startup.ps1
9. **Documentazione non aggiornata** â†’ Aggiunte istruzioni AI e skill di gestione CSV

---

## ðŸ“‚ File Modificati

### 1. **index.html** âœï¸
- âœ… Aggiunto cache-busting a `display.csv` e `NextCoreo.csv`
- âœ… Aggiunto `{ cache: 'no-store' }` ai fetch
- âœ… Aggiunto BOM stripping per Unicode
- âœ… Migliorato error handling con messaggi descrittivi
- âœ… Aggiunto logging in console per debug

### 2. **servizio2.html** âœï¸
- âœ… Aggiunto cache-busting a `servizio.csv` e `NextCoreo.csv`
- âœ… Implementati fallback intelligenti (servizio.csv â†’ NextCoreo.csv)
- âœ… Aggiunto BOM stripping
- âœ… Migliorato error handling
- âœ… Aggiunto logging per debug

### 3. **Prova/ScriptPDF1.html** âœï¸
- âœ… Aggiornato porta API da `localhost:8765` a `127.0.0.1:8765`
- âœ… Aggiunto timeout robusto (8s) con AbortController
- âœ… Aggiunto retry logic per fetch
- âœ… Messaggi di errore piÃ¹ descrittivi
- âœ… Aggiunto console logging con suggerimenti

### 4. **script.js** âœ“
- âœ… GiÃ  configurato correttamente con cache-busting
- âœ… Nessuna modifica necessaria (stable)

### 5. **pdf-server.js** âœï¸
- âœ… Aggiunta lettura porta da env variable `PDF_SERVER_PORT`
- âœ… Default porta: 8765 (configurabile)
- âœ… Aggiornati log startup con URL corretti (127.0.0.1)
- âœ… Migliorati messaggi di avvio

---

## ðŸ“‚ File Creati

### 1. **start-pdf-server.ps1** ðŸ†•
Script PowerShell intelligente per avviare il PDF Server:
- âœ… Verifica Node.js installato
- âœ… Controlla se server Ã¨ giÃ  in esecuzione
- âœ… Installa dipendenze npm se necessarie
- âœ… Avvia il server su porta 8765 (configurabile)
- âœ… Output chiaro e messaggi di debug
- âœ… Supportive usage: `.\start-pdf-server.ps1` oppure `.\start-pdf-server.ps1 -UsePort5500`

### 2. **stop-pdf-server.ps1** ðŸ†•
Script PowerShell per fermare il PDF Server:
- âœ… Cerca processi Node.js con pdf-server
- âœ… Ferma i processi in modo sicuro
- âœ… Pulisce job di PowerShell
- âœ… Verifica che siano effettivamente chiusi
- âœ… Usage: `.\stop-pdf-server.ps1`

### 3. **utility.js** ðŸ†•
Libreria JavaScript con helper globali:
- âœ… `fetchWithTimeoutAndRetry()` - Fetch robusto con timeout e retry
- âœ… `loadCSV()` - Carica CSV con skip header
- âœ… `isPdfServerAvailable()` - Verifica disponibilitÃ  server
- âœ… `fetchPdfServer()` - Fetch verso API server PDF
- âœ… `showNotification()` - Mostra notifiche eleganti
- âœ… `initApp()` - Inizializzazione app con diagnostica
- âœ… Configurazione globale via `window.AppConfig`
- âœ… DEBUG mode per logging in console
- âœ… Include: `<script src="/utility.js"></script>`

### 4. **diagnostica.html** ðŸ†•
Pagina HTML di diagnostica per testare l'intero sistema:
- âœ… Test Live Server (porta 5500)
- âœ… Test PDF Server (porta 8765)
- âœ… Test caricamento CSV files
- âœ… Pulsanti per eseguire test singoli o tutti insieme
- âœ… Riepilogo risultati con contatori
- âœ… Log dettagliati per ogni test
- âœ… URL: `http://127.0.0.1:5500/diagnostica.html`

### 5. **launch-all.ps1** ðŸ†•
Script master per avviare l'intera soluzione:
- âœ… Verifica Node.js e npm
- âœ… Installa dipendenze se necessarie
- âœ… Verifica disponibilitÃ  porte
- âœ… Avvia Live Server
- âœ… Avvia PDF Server
- âœ… Output con URL di accesso
- âœ… Usage: `.\launch-all.ps1`

### 6. **README_SETUP_STABILE.md** ðŸ†•
Documentazione completa con:
- âœ… Sommario delle correzioni
- âœ… Istruzioni di avvio (3 opzioni)
- âœ… Configurazione file CSV
- âœ… Configurazione avanzata
- âœ… Troubleshooting dettagliato
- âœ… Diagramma architettura
- âœ… Checklist di verifica
- âœ… Note importanti

### 7. **CHANGELOG.md** ðŸ†• (questo file)
Documento di track delle modifiche

---

## ðŸ” Dettagli Tecnici

### Architettura di rete:
```
Client Browser (http://127.0.0.1:5500)
    â”œâ”€ Fetch CSV files locali (display.csv, NextCoreo.csv, servizio.csv)
    â””â”€ Fetch API da PDF Server (http://127.0.0.1:8765/api/*)
        â”œâ”€ /api/pdf-list       (GET lista PDF)
        â”œâ”€ /api/open-pdf       (POST apri PDF)
        â””â”€ /api/close-chrome   (POST chiudi Chrome)
```

### Timeout e Retry:
- **Timeout**: 10.000 ms (10 secondi) per fetch standard
- **Retry**: 2 tentativi con backoff esponenziale
- **Cache-busting**: `?t=Date.now()` su tutti i CSV

### URL corretti:
- Live Server: `http://127.0.0.1:5500` (porta standard VSCode)
- PDF Server: `http://127.0.0.1:8765` (configurabile via env)
- CSV Files: Serviti da Live Server (no `/api/`)

### BOM Handling:
Tutti i CSV scritti da Excel possono avere BOM Unicode (Byte Order Mark).
Soluzione: `.replace(/^\uFEFF/, "").trim()`

---

## âœ… Checklist di verifica

- [x] Tutti i fetch usano URL corretti (127.0.0.1)
- [x] Cache-busting implementato su tutti i CSV
- [x] Timeout di 10s su fetch richiesti
- [x] Retry automatico implementato
- [x] Error handling migliorato
- [x] Script PowerShell creati e testati
- [x] utility.js implementato con helper
- [x] diagnostica.html creato
- [x] launch-all.ps1 creato
- [x] Documentazione completa (README_SETUP_STABILE.md)
- [x] Console logging per debug
- [x] Messaggi di errore descrittivi
- [x] BOM stripping implementato
- [x] Notifiche eleganti (showNotification)

---

## ðŸš€ Come usare la soluzione

### Avvio rapido (CONSIGLIATO):
```powershell
.\launch-all.ps1
```

Questo avvia automaticamente:
1. Live Server su porta 5500
2. PDF Server su porta 8765
3. Mostra tutti gli URL di accesso

### Avvio manuale:
```powershell
# Terminale 1: Live Server
npx http-server -c-1

# Terminale 2: PDF Server
.\start-pdf-server.ps1
```

### Test della soluzione:
Apri: `http://127.0.0.1:5500/diagnostica.html`

Clicca "Esegui tutti i test" per verificare che tutto funziona.

---

## ðŸ“… Aggiornamenti 4 Aprile 2026

### ðŸ”§ Nuove FunzionalitÃ  Aggiunte

#### 1. **Automazione Completa Startup** âœï¸
- âœ… Modificato `startup.ps1` per eseguire automaticamente `generate_report_data.py` all'avvio
- âœ… Eliminata necessitÃ  di attivazione manuale virtual environment (usa percorso assoluto Python)
- âœ… Sistema completamente operativo senza comandi manuali aggiuntivi

#### 2. **Istruzioni AI per Workspace** ðŸ†•
- âœ… Creato `.github/copilot-instructions.md` con guide complete per agenti AI
- âœ… Documentate convenzioni progetto (CSV parsing, cache-busting, etc.)
- âœ… Include esempi e linee guida per manutenzione

#### 3. **Skill CSV Manager** ðŸ†•
- âœ… Creato `.github/skills/csv-manager/` con SKILL.md e script
- âœ… Script `validate_csv.py` per validazione struttura CSV
- âœ… Script `sync_csvs.ps1` per sincronizzazione root â†” public/
- âœ… Skill invocabile con `/csv-manager` per gestione sicura CSV

#### 4. **Prompt Firebase Deploy** ðŸ†•
- âœ… Creato `.github/prompts/firebase-deploy.prompt.md`
- âœ… Automatizza deployment con checklist pre-deploy
- âœ… Include sync CSV, test locali, deploy e verifica post-deploy

#### 5. **Risoluzione Virtual Environment** âœ…
- âœ… Risolto errore "script not digitally signed" con `-ExecutionPolicy Bypass`
- âœ… Script Python usano percorso assoluto, no attivazione manuale richiesta

---

---

## ðŸ“Š Performance

- **Timeout fetch**: 10 secondi (configurabile in `utility.js`)
- **Retry**: 2 tentativi con backoff 500ms, 1000ms
- **Cache-busting**: Disabled (cache: 'no-store')
- **CSV max size**: Nessun limite (performance OK per dataset < 10MB)

---

## ðŸ” Sicurezza

- âœ… Nessuna esposizione di password/segreti
- âœ… CORS middleware presente in pdf-server.js
- âœ… File system limited a C:\SCRIPT_PDF per PDF
- âœ… Nessun eval() o dynamic code execution
- âœ… Validazione input su API endpoints

---

## ðŸ“ž Support / Debugging

Se trovi problemi:

1. **Apri console browser** (F12)
2. **Visita** `http://127.0.0.1:5500/diagnostica.html`
3. **Clicca** "Esegui tutti i test"
4. **Condividi** lo screenshot dei risultati

Tutti i log sono nella console browser (F12 > Console tab).

---

## âœ¨ Status Finale

```
ðŸŽ‰ STABILE E FUNZIONANTE

âœ… Tutti i fetch hanno timeout e retry
âœ… Tutti i CSV hanno cache-busting
âœ… Error handling completo
âœ… Auto-avvio server funzionante
âœ… Diagnostica disponibile
âœ… Documentazione completa

Pronto per il deploy! ðŸš€
```

---

**Data**: 20 Febbraio 2026
**Versione**: 1.0.0-stable
**Status**: âœ… LIVE


