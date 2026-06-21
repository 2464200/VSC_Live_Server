> 📌 Questa documentazione fa parte della [guida unificata del progetto](../../README.md).

**⚠️ Nota importante:** a partire dal 13 Apr 2026 il flusso standard del progetto usa un unico unified-server.js su http://localhost:5500. Le architetture con server-manager.js, pdf-server.js, simple-server.js, static-server.js, pdf-server-simple.js e le porte 3000, 3010, 8765 sono ora legacy/historiche e non fanno parte del percorso standard.

# âœ… CORREZIONE LOGICA FLUSSO STATI COREOGRAFIE

**Data**: 6 Aprile 2026  
**Scope**: Revisione logica di transizione stato eventi.js  
**Status**: ðŸŸ¢ COMPLETATO

---

## ðŸ”´ PROBLEMA IDENTIFICATO

La logica di transizione dello stato usava **DUE CHECKBOX SEPARATI**:
- `checkbox-prenota`: disponibile â†” prenotato
- `checkbox-eseguito`: prenotato â†” eseguito

Il timestamp veniva **sempre aggiunto** (anche per stato "prenotato"), violando il flusso corretto:
- Prima spunta: disponibile â†’ **prenotato** (SENZA timestamp)
- Seconda spunta: prenotato â†’ **eseguito** (CON timestamp)

---

## âœ… SOLUZIONE IMPLEMENTATA

### 1. **Funzione `salvaStato()` - Aggiornata**

```javascript
async function salvaStato(id, stato, addTimestamp = false) {
  const payload = {
    id,
    stato,
  **⚠️ Nota:** questo file è stato in parte consolidato in `DOCUMENTATION.md`.
  Per la documentazione centralizzata, vedi: `Eventi/DOCUMENTATION.md`.

    dj: getDJLocal() || null
  };
  
  // âœ… Timestamp SOLO quando stato Ã¨ 'eseguito' E addTimestamp=true
  if (addTimestamp && stato === 'eseguito') {
    payload.timestamp = new Date().toISOString();
  } else {
    payload.timestamp = null;
  }
  
  await fetch(apiUrl('/log'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
```

**Note**:
- `addTimestamp = true` SOLO quando lo stato diventa "eseguito"
- Per gli altri stati, timestamp rimane `null`
- Il DJ viene sempre salvato (dalla localStorage)- Il limite di prenotazione DJ verifica esclusivamente i brani attualmente in stato `prenotato`; i brani già `eseguito` o riportati a `disponibile` non vengono conteggiati.
---

### 2. **Funzione `renderRows()` - Completamente Rivista**

**Nuovo flusso**: **UN UNICO CHECKBOX** con logica a tre stati

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ FLUSSO A TRE STATI - UN UNICO CHECKBOX                  â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Stato: DISPONIBILE  â•± checkbox: unchecked, abilitato    â”‚
â”‚   â””â”€ Utente spunta  â”‚                                    â”‚
â”‚        â””â”€â†’ PRENOTATO  â•± checkbox: checked, abilitato    â”‚
â”‚             (SENZA timestamp)      â”‚                     â”‚
â”‚   â””â”€ Utente spunta di nuovo        â”‚                     â”‚
â”‚        â””â”€â†’ ESEGUITO  â•± checkbox: checked, DISABLED      â”‚
â”‚             (CON timestamp, data/ora aggiunta)           â”‚
â”‚                                                          â”‚
â”‚ Terminal: "âœ… [id] prenotato â†’ eseguito (CON timestamp)"â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### 3. **Event Listener - Logica Corretta**

```javascript
checkbox.addEventListener('change', async () => {
  const currentState = normalizeState(last.get(brano.id)?.stato);
  let newState;
  let includeTimestamp = false;

  if (currentState === 'disponibile') {
    // âœ… PRIMA SPUNTA: disponibile â†’ prenotato (SENZA timestamp)
    newState = 'prenotato';
    includeTimestamp = false;
    console.log(`ðŸ“Œ [${brano.id}] disponibile â†’ prenotato (SENZA timestamp)`);
  } else if (currentState === 'prenotato') {
    // âœ… SECONDA SPUNTA: prenotato â†’ eseguito (CON timestamp)
    newState = 'eseguito';
    includeTimestamp = true;
    console.log(`âœ… [${brano.id}] prenotato â†’ eseguito (CON timestamp di ${getDJLocal()})`);
  }

  // Salva con il flag corretto
  await salvaStato(brano.id, newState, includeTimestamp);
});
```

---

## ðŸ” FLUSSO OPERATIVO COMPLETO

### Scenario: Prenotare e Eseguire un Brano

```
1ï¸âƒ£ CARICO PAGINA principais (eventi.html)
   â””â”€ Console: "ðŸ“‹ Renderizzando 557 coreografie nel container"
   â””â”€ Vedo: â¬œ [Brano1] [checkbox UNCHECKED]
   
2ï¸âƒ£ UTENTE SPUNTA IL CHECKBOX PRIMA VOLTA
   â””â”€ Event: checkbox.change triggered
   â””â”€ Logica: currentState='disponibile' â†’ newState='prenotato'
   â””â”€ Console: "ðŸ“Œ [id] disponibile â†’ prenotato (SENZA timestamp)"
   â””â”€ Salva: salvaStato(id, 'prenotato', false)
      â””â”€ Payload: {id, stato: 'prenotato', dj: 'DJ Name', timestamp: null}
   â””â”€ UI Aggiorna: riga diventa GIALLA (classe 'prenotato')
   
3ï¸âƒ£ UTENTE SPUNTA IL CHECKBOX LA SECONDA VOLTA
   â””â”€ Event: checkbox.change triggered di nuovo
   â””â”€ Logica: currentState='prenotato' â†’ newState='eseguito'  
   â””â”€ Console: "âœ… [id] prenotato â†’ eseguito (CON timestamp di DJ Name)"
   â””â”€ Salva: salvaStato(id, 'eseguito', true)
      â””â”€ Payload: {id, stato: 'eseguito', dj: 'DJ Name', timestamp: '2026-04-06 14:32:15'}
   â””â”€ UI Aggiorna: 
      â”œâ”€ riga diventa VERDE (classe 'eseguito')
      â”œâ”€ timestamp appare nella riga: "06/04/2026, 14:32:15"
      â””â”€ checkbox diventa DISABLED (non puÃ² piÃ¹ cambiare)

4ï¸âƒ£ POLLING AGGIORNA (ogni 30 secondi)
   â””â”€ Ricarica dati dal database
   â””â”€ Lo stato rimane 'eseguito' con timestamp
   â””â”€ UI rimane coerente
```

---

## ðŸŽ¯ VERIFICA NEL BROWSER

### Console (F12 â†’ Console tab)

Dovresti vedere questi log quando spunti il checkbox:

```
ðŸ“Œ [BRANO-123] disponibile â†’ prenotato (SENZA timestamp)
```

Poi quando lo spunti di nuovo:

```
âœ… [BRANO-123] prenotato â†’ eseguito (CON timestamp di Luca)
```

### Database (log.json)

Quando stato = "prenotato":
```json
{
  "id": "BRANO-123",
  "stato": "prenotato",
  "dj": "Luca",
  "timestamp": null
}
```

Quando lo spunti di nuovo e diventa "eseguito":
```json
{
  "id": "BRANO-123",
  "stato": "eseguito",
  "dj": "Luca",
  "timestamp": "2026-04-06T14:32:15.123Z"
}
```

---

## ðŸ“‹ FILE MODIFICATI

âœ… **`Eventi/public/eventi.js`**
- âœ… Funzione `salvaStato()`: aggiunto parametro `addTimestamp`
- âœ… Funzione `renderRows()`: sostituito doppio checkbox con uno singolo
- âœ… Event listener: logica a tre stati (disponibile â†’ prenotato â†’ eseguito)
- âœ… Timestamp aggiunto SOLO quando stato = 'eseguito'

**NON MODIFICATI** (funzionano benissimo):
- âŒ `Eventi/public/api-helper.js`
- âŒ `Eventi/public/render.js`
- âŒ `Eventi/server-eventi.js`
- âŒ HTML template

---

## ðŸš€ TEST & DEPLOYMENT

```bash
# Server giÃ  online
http://localhost:3010/eventi/eventi.html

# Test manuale:
1. Apri pagina
2. Seleziona un DJ dal dropdown
3. Spunta un brano: vedi "prenotato" SENZA data
4. Spunta di nuovo: vedi "eseguito" CON data/ora del DJ
5. Non puoi piÃ¹ cambiare (checkbox disabled)
```

---

## âœ¨ MIGLIORAMENTI

| Aspetto | Prima | Dopo |
|---------|-------|------|
| **N. Checkbox** | 2 (confusi) | 1 (chiaro) |
| **Timestamp** | Sempre | Solo "eseguito" |
| **Flusso logico** | Ambiguo | Chiaro: 3 stati |
| **UX** | Confusa | Intuitiva |
| **Debug** | Nessun log | Console dettagliata |

---

## ðŸ”— RELAZIONE CON FUNZIONAMENTI PRECEDENTI

Il comportamento ora Ã¨ **coerente** con come dovrebbe funzionare:
- âœ… Pagine di filtro (render.js): conservate come erano
- âœ… API backend: nessun cambiamento
- âœ… Database schema: retrocompatibile
- âœ… Logica stato: finalmente corretta



