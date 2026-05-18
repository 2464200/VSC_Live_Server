**⚠️ Nota:** questo file è stato in parte consolidato in `DOCUMENTATION.md`.
Per la documentazione centralizzata, vedi: `Eventi/DOCUMENTATION.md`.

**⚠️ Nota importante:** a partire dal 13 Apr 2026 il flusso standard del progetto usa un unico unified-server.js su http://localhost:5500. Le architetture con server-manager.js, pdf-server.js, simple-server.js, static-server.js, pdf-server-simple.js e le porte 3000, 3010, 8765 sono ora legacy/historiche e non fanno parte del percorso standard.

# Verifica Nuove FunzionalitÃ  - Coreografie Aggiuntive

**Data**: 9 Aprile 2026  
**Status**: âœ… Verificato

## 1. IntegritÃ  Generale del Sistema

- âœ… Server unificato operativo su porta 5500
- âœ… API Eventi raggiungibile
- âœ… API DJ raggiungibile
- âœ… Nessun conflitto con funzionalitÃ  esistenti

## 2. Nuove FunzionalitÃ  - Sommario

### Pagina: `coreografie-aggiuntive.html`
- **Ubicazione**: `Eventi/public/coreografie-aggiuntive.html`
- **Descrizione**: Visualizza e consente la modifica delle coreografie dal CSV aggiuntivo
- **Fonte dati**: `Coreografie_Aggiuntive.csv`
- **FunzionalitÃ **:
  - Caricamento CSV con parsing semicolon-delimited
  - Visualizzazione elenco brani aggiuntivi (modal di modifica **nascosto al caricamento**)
  - Ricerca per coreografia, brano, autore
  - Modal di modifica si apre **solo su richiesta dell'utente** (click pulsante "Modifica")
  - Pulsanti funzionali: `Modifica`, `Elimina`, X (chiudi), Salva, Annulla
  - Salvataggio ed eliminazione tramite API

### Script: `coreografie-aggiuntive.js`
- **Ubicazione**: `Eventi/public/coreografie-aggiuntive.js`
- **Funzioni principali**:
  - `loadCoreografieAggiuntive()` - Carica CSV da `/Coreografie_Aggiuntive.csv`
  - `parseCoreografieCSV()` - Parsing con separatore punto-e-virgola
  - `renderCoreografie()` - Renderizza righe con pulsanti `Modifica` e `Elimina`
  - `openEditModal()` - Apre modal di modifica (richiesto da utente)
  - `closeEditModal()` - Chiude il modal (X, Annulla)
  - `saveEdit()` - Salva tramite API
  - `deleteCoreografia()` - Elimina tramite API e aggiorna la lista
  - `setupModalEventListeners()` - Assoggetta i listener ai pulsanti una sola volta (protezione contro duplicati)

### Endpoint API: `POST /api/aggiuntive/update`
- **Ubicazione**: `Eventi/eventi-server.js`
- **Metodo**: POST
- **Body**:
  ```json
  {
    "id": "EXTRA1",
    "coreografia": "Big",
    "brano": "Big",
    "autore": "Trace Adkins"
  }
  ```
- **Risposta**: JSON con `ok: true` e dati aggiornati

### Endpoint API: `POST /api/aggiuntive/delete`
- **Ubicazione**: `Eventi/eventi-server.js` e `unified-server.js`
- **Metodo**: POST
- **Body**:
  ```json
  {
    "id": "EXTRA1"
  }
  ```
- **Risposta**: JSON con `ok: true` e dati eliminati
- **Nota**: e' disponibile anche il fallback `DELETE /api/aggiuntive/:id`

### Funzione Backend: `updateExtraBrano()`
- **Ubicazione**: `Eventi/brani-utils.js`
- **Descrizione**: Aggiorna riga nel CSV aggiuntivo e sincronizza JSON
- **Verifica**: Ricerca l'ID, aggiorna i campi, risincronizza brani.json

## 3. Coerenza Visiva e UX

### Stili CSS Aggiunti
- **`.modal`** - Overlay di modifica
- **`.modal[hidden]`** - Rule per nascondere il modal tramite attributo hidden (display: none !important)
- **`.modal-content`** - Container del modal
- **`.modal-header`** - Intestazione del modal
- **`.modal-body`** - Body del modal con form
- **`.modal-actions`** - Pulsanti di salvataggio/annullamento
- **`.edit-btn`** - Pulsante arancione "Modifica"
- **`.delete-btn`** - Pulsante rosso "Elimina"
- **`.riga-brano.aggiuntiva`** - Stile riga coerente (sfondo arancione chiaro)

### Coerenza con Progetto
- âœ… Utilizzo variabili CSS di progetto (`--accent`, `--text`, `--muted`, etc.)
- âœ… Stessi font (`Segoe UI`)
- âœ… Stesse spaziature e border-radius
- âœ… Animazioni e shadow coerenti

## 4. Formato CSV - Standardizzazione

### Formato Prima
`Coreografie_Aggiuntive.csv` usava virgola (`,`) come separatore

### Formato Dopo
- âœ… Convertito a punto-e-virgola (`;`) come `Elenco_Brani_statico.csv`
- âœ… Header allineato
- âœ… Indici colonne sincronizzati

**Struttura CSV**:
```
Colonna 1;Colonna 2;ID;coreografia;brano;autore;...
;;EXTRA1;Big;Big;Trace Adkins;...
```

## 5. Flusso di Prenotazione/Esecuzione - Non Alterato

La nuova pagina e funzionalitÃ :
- âœ… Non interferisce con stati `disponibile`, `prenotato`, `eseguito`
- âœ… Non modifica il flusso di prenotazione in `eventi.html`
- âœ… Non modifica checkbox `Eseguito` in `prenotati.html`
- âœ… Non modifica checkbox `Annulla` in `spuntati.html`
- âœ… Non modifica render dei brani in alcuna pagina di filtro
- âœ… Non modifica visualizer
- âœ… Non modifica statistiche DJ

**Motivo**: La pagina coreografie-aggiuntive Ã¨ una vista **separata** e di **gestione amministrativa** del CSV aggiuntivo. Non Ã¨ parte del flusso operativo di prenotazione/esecuzione.

## 6. Documentazione Aggiornata

### README_EVENTI.md
- âœ… Aggiunta funzionalitÃ  principale: "gestione e modifica coreografie aggiuntive"
- âœ… URL aggiunto: `coreografie-aggiuntive.html`
- âœ… File HTML e JS aggiunti all'architettura
- âœ… Endpoint API aggiunto a lista endpoint
- âœ… Nota operativa aggiornata: visualizzazione, modifica, eliminazione e sorgente CSV principale corretta

## 7. Integrazione nella Navigazione

### Homepage (`eventi.html`)
- âœ… Pulsante "Coreografie Aggiuntive" aggiunto al menu di navigazione
- âœ… Posizionamento logico (dopo "Statistiche DJ", prima di "Visualizer")
- âœ… Stile coerente (pulsante scuro con testo bianco)

### Altre Pagine di Filtro
- âœ… Pulsante disponibile in `prenotati.html`, `spuntati.html`, `non-spuntati.html`, `tutti.html`
- âœ… Consente rapida alternanza tra viste

## 8. Percorsi Completi

| File | Percorso | Stato |
|------|---------|-------|
| HTML pagina | `Eventi/public/coreografie-aggiuntive.html` | âœ… Presente |
| JS logica | `Eventi/public/coreografie-aggiuntive.js` | âœ… Presente |
| CSV dati | `Eventi/Coreografie_Aggiuntive.csv` | âœ… Convertito a `;` |
| Funzione backend | `Eventi/brani-utils.js#updateExtraBrano()` | âœ… Presente |
| Funzione backend delete | `Eventi/brani-utils.js#deleteExtraBrano()` | âœ… Presente |
| Endpoint API | `Eventi/eventi-server.js#POST /aggiuntive/update` e `POST /aggiuntive/delete` | âœ… Presenti |
| Stile CSS | `Eventi/public/style.css` | âœ… Aggiunto `.modal*`, `.riga-brano.aggiuntiva`, `.delete-btn` |
---

# Modifiche 25 Aprile 2026 - Export CSV SIAE e Miglioramenti UI

**Data**: 25 Aprile 2026  
**Status**: ✅ Implementato

## 1. Export CSV per SIAE

### Funzionalità
- **Bottone**: "Esporta CSV per SIAE" in `eventi.html`
- **Protezione**: Richiede password `0000` prima dell'esportazione
- **Nome file**: `GG-MM-AAAA-HHHH_SIAE_VSC.csv` (es. `25-04-2026-1654_SIAE_VSC.csv`)
- **Percorso**: `c:\VSC_SIAE\` (creata automaticamente se manca)

### Formato CSV SIAE
```csv
Titolo,Autore,Compositore,Performer,Durata
3 FLICKS,ann tayler,,
Big,Trace Adkins,,
```

### Caratteristiche
- ✅ Solo brani con stato `eseguito` inclusi
- ✅ Ordinamento alfabetico (supporto accenti, numeri, simboli)
- ✅ Escape campi con virgole/virgolette
- ✅ Codifica UTF-8

### File modificati
| File | Modifica |
|------|----------|
| `Eventi/public/eventi.html` | Bottone rinominato |
| `Eventi/public/eventi.js` | Parametro `siae=1` + verifica password |
| `unified-server.js` | Nuova logica export con formato 5 campi |

## 2. Normalizzazione ID Extra

### Prima
- `EXTRA-PROVA4-PROVA4-PROVA4`
- `EXTRA-PROVA5-PROVA5-PROVA5`

### Dopo
- `EXTRA4`
- `EXTRA5`

### File modificati
| File | Modifica |
|------|----------|
| `Eventi/brani-utils.js` | `buildStableExtraId()` → `EXTRA${rowNumber}` |
| `Eventi/Coreografie_Aggiuntive.csv` | EXTRA4, EXTRA5 |
| `Eventi/data/brani.json` | EXTRA4, EXTRA5 |
| `Eventi/data/log.json` | EXTRA5 |

## 3. Protezione Password

### Azioni protette
- **Esporta CSV per SIAE**
- **Reset date e orari**

### Nuova protezione: Selezione DJ
- **Cambio DJ (eventi.html)**: la selezione di un nuovo DJ richiede ora l'inserimento della password di sistema; se la password è errata o l'operatore annulla l'operazione, la selezione non viene applicata e resta in uso il DJ precedente.
- **Configurazione**: la password è hardcoded una sola volta in `Eventi/public/config.js` come `window.SYSTEM_PASSWORD` e viene usata da tutte le pagine del modulo.

### Comportamento
- Password richiesta: `0000`
- Se errata: alert + redirect a `eventi.html`

### Codice
```javascript
function verifyPassword(actionType) {
  const password = prompt('Inserisci password per confermare: ' + actionType);
  if (password === null || password !== window.SYSTEM_PASSWORD) {
    alert('Password errata. Verrai reindirizzato alla pagina principale.');
    goEventiPage('eventi.html');
    return false;
  }
  return true;
}
```

## 4. Bottone "Torna a inserimento"

### Ubicazione
- `coreografie-aggiuntive.html` - dopo "Apri visualizer"

### Stile
```html
<button onclick="goEventiPage('eventi.html#inserimento')" 
        style="background:#ffc107;color:#000;font-weight:700;">
  Torna a inserimento
</button>
```

### Funzionamento
1. Redirect a `eventi.html#inserimento`
2. Apertura automatica pannello inserimento coreografie

## 5. Miglioramento Visibilità Bottoni

### Bottoni aggiornati (colore giallo #ffca28)
- "Salva nuova coreografia"
- "Apri elenco aggiuntive"
- "Chiudi"

### Stile applicato
```html
style="background:#ffca28;color:#000;font-weight:700;"
```| Docs | `Eventi/README_EVENTI.md` | âœ… Aggiornato |

## 9. Test di DisponibilitÃ 

### URL Accessibili
- âœ… `http://localhost:5500/eventi/coreografie-aggiuntive.html`
- âœ… `http://localhost:5500/eventi/api/aggiuntive/update` (POST)
- âœ… `http://localhost:5500/eventi/api/aggiuntive/delete` (POST)
- âœ… `http://localhost:5500/Coreografie_Aggiuntive.csv` (GET)

### Script Caricati Correttamente
- âœ… `event-navigation.js` - Navigazione tra pagine
- âœ… `inactivity-return.js` - Ritorno automatico dopo 60s
- âœ… `api-helper.js` - Helper per fetch API
- âœ… `coreografie-aggiuntive.js` - Logica principale

## 10. Errori e Warnings

- âœ… **Zero errori** nei file HTML/JS/CSS
- âœ… **Zero warning** di sintassi
- âœ… **Sistema test**: PASS

## 11. Correzione Endpoint API (Risoluzione Errore 404)

### Problema Identificato
L'endpoint `/aggiuntive/update` era stato aggiunto a:
- âœ… `Eventi/eventi-server.js` (router standalone legacy)

Ma NON era disponibile in:
- âŒ `unified-server.js` (server attualmente in uso)

Il server unificato definisce il suo router locale e non usa il file `Eventi/eventi-server.js`, quindi l'endpoint non era mai raggiunto.

### Soluzione Applicata
1. **Aggiunto import** in `unified-server.js` (linea 17):
   ```javascript
   const { syncBraniJson, appendExtraBrano, updateExtraBrano, EXTRA_CSV_NAME } = require('./Eventi/brani-utils');
   ```

2. **Aggiunto endpoint** in `unified-server.js` (linea 514):
   ```javascript
   router.post('/aggiuntive/update', (req, res) => {
     try {
       const { id, coreografia, brano, autore } = req.body;
       if (!id) return res.status(400).json({ error: 'ID non fornito' });
       const result = updateExtraBrano(id, { coreografia, brano, autore });
       res.json(result);
     } catch (e) {
       res.status(400).json({ error: e.message || 'Errore aggiornamento coreografia' });
     }
   });
   ```

3. **Percorso corretto** nel frontend (`coreografie-aggiuntive.js`):
   - Fetch URL: `/eventi/api/aggiuntive/update`

### Test di Verifica
- âœ… Endpoint raggiungibile: `POST http://localhost:5500/eventi/api/aggiuntive/update` â†’ **HTTP 200**
- âœ… CSV aggiornato: Test di scrittura EXTRA3 completato con successo
- âœ… Dati ripristinati: CSV riportato ai valori originali post-test

## Conclusioni

âœ… **Tutte le nuove funzionalitÃ  sono PIENAMENTE OPERATIVE.**

- L'errore 404 Ã¨ stato risolto
- Il modal di modifica funziona correttamente
- I pulsanti del modal sono responsivi
- Le modifiche al CSV vengono salvate nella base di dati
- Le eliminazioni dal CSV aggiuntivo vengono recepite subito in elenco e sincronizzazione
- Il sistema continua ad essere completamente operativo

---

**Verificato da**: Sistema automatico  
**Data verifica**: 9 Aprile 2026  
**Status finale**: âœ… OPERATIVO E TESTATO


