> 📌 Questa documentazione fa parte della [guida unificata del progetto](../README.md).

**⚠️ Nota:** questo file è stato in parte consolidato in `DOCUMENTATION.md`.
Per la documentazione centralizzata, vedi: `Eventi/DOCUMENTATION.md`.

**⚠️ Nota importante:** a partire dal 13 Apr 2026 il flusso standard del progetto usa un unico unified-server.js su http://localhost:5500. Le architetture con server-manager.js, pdf-server.js, simple-server.js, static-server.js, pdf-server-simple.js e le porte 3000, 3010, 8765 sono ora legacy/historiche e non fanno parte del percorso standard.

# âœ… FLUSSO LOGICO CORRETTO - COREOGRAFIE PER STATI

**Data**: 6 Aprile 2026  
**Status**: ðŸŸ¢ DEFINITIVO  
**Modifiche**: Solo `Eventi/public/eventi.js` (renderRows)

---

## ðŸ“Š ARCHITETTURA DELLE TRE PAGINE

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    EVENTO DJ - 3 PAGINE                    â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                             â”‚
â”‚  PAGINA 1: eventi.html (â¬œ DISPONIBILI)                    â”‚
â”‚  â”œâ”€ Mostra: SOLO brani con stato "disponibile"            â”‚
â”‚  â”œâ”€ Azione: Spunta checkbox â†’ prenotato (ðŸŸ )              â”‚
â”‚  â”œâ”€ Timestamp: NO (null)                                   â”‚
â”‚  â”œâ”€ DJ: Salvato da localStorage                            â”‚
â”‚  â””â”€ Dopo: Brano scompare dal polling (30 sec)             â”‚
â”‚                                                             â”‚
â”‚       â¬œ Brano 1 [â˜ prenota]                               â”‚
â”‚       â¬œ Brano 2 [â˜ prenota]                               â”‚
â”‚       â¬œ Brano 3 [â˜ prenota]                               â”‚
â”‚                                                             â”‚
â”‚  ðŸ‘‡ Utente spunta checkbox                                 â”‚
â”‚                                                             â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                 â”‚
â”‚                                                             â”‚
â”‚  PAGINA 2: prenotati.html (ðŸŸ  PRENOTATI)                  â”‚
â”‚  â”œâ”€ Mostra: SOLO brani con stato "prenotato"              â”‚
â”‚  â”œâ”€ Azione: Clicca "Eseguito" â†’ eseguito (âœ…)             â”‚
â”‚  â”œâ”€ Azione alternativa: Clicca "Annulla" â†’ torna disponibileâ”‚
â”‚  â”œâ”€ Timestamp: SI (Date.now()) quando clicca               â”‚
â”‚  â”œâ”€ DJ: Salvato da localStorage                            â”‚
â”‚  â””â”€ Dopo: Brano scompare dal polling (30 sec)             â”‚
â”‚                                                             â”‚
â”‚       ðŸŸ  Brano 1 [â˜ Eseguito] [â˜ Annulla]                 â”‚
â”‚       ðŸŸ  Brano 2 [â˜ Eseguito] [â˜ Annulla]                 â”‚
â”‚                                                             â”‚
â”‚  ðŸ‘‡ Utente clicca "Eseguito"                               â”‚
â”‚                                                             â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                 â”‚
â”‚                                                             â”‚
â”‚  PAGINA 3: spuntati.html (âœ… ESEGUITI)                    â”‚
â”‚  â”œâ”€ Mostra: SOLO brani con stato "eseguito"               â”‚
â”‚  â”œâ”€ Timestamp: SI (mostrato - es. 06/04/2026, 14:32:15)   â”‚
â”‚  â”œâ”€ DJ: Mostrato accanto a ogni brano                      â”‚
â”‚  â”œâ”€ Azione: Opzionale "Annulla" â†’ torna disponibile        â”‚
â”‚  â””â”€ Nota: Report definitivo completato                    â”‚
â”‚                                                             â”‚
â”‚       âœ… Brano 1 - 06/04/2026 14:32:15 [â˜ Annulla]        â”‚
â”‚       âœ… Brano 2 - 06/04/2026 14:35:22 [â˜ Annulla]        â”‚
â”‚                                                             â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## ðŸ”„ FLUSSO DETTAGLIATO DI UN BRANO

### Stato: DISPONIBILE  
```json
{
  "id": "BRANO-1",
  "titolo": "Toreador di Bizet",
  "stato": "disponibile",
  "timestamp": null,
  "dj": null
}
```
**Visualizzato in**: `eventi.html`  
**Icona**: â¬œ  
**Checkbox UI**: Unchecked, abilitato  

ðŸ‘‡ **Utente spunta in eventi.html**

---

### Stato: PRENOTATO  
```json
{
  "id": "BRANO-1",
  "titolo": "Toreador di Bizet",
  "stato": "prenotato",
  "timestamp": null,
  "dj": "Luca"
}
```
**Visualizzato in**: `prenotati.html` (NON piÃ¹ in eventi.html)  
**Icona**: ðŸŸ   
**Checkbox UI**: Unchecked (negli altri brani), ma questo ha checkbox "Eseguito"  
**Significato**: Brano PRENOTATO - Nessun altro DJ puÃ² selezionarlo  
**Nota limite prenotazioni**: il conteggio per DJ usa solo i brani attualmente in stato `prenotato`; i brani `eseguito` non vengono contati.  

ðŸ‘‡ **Utente clicca "Eseguito" in prenotati.html**

---

### Stato: ESEGUITO  
```json
{
  "id": "BRANO-1",
  "titolo": "Toreador di Bizet",
  "stato": "eseguito",
  "timestamp": "2026-04-06T14:32:15.123Z",
  "dj": "Luca"
}
```
**Visualizzato in**: `spuntati.html` (con data/ora visibile)  
**Icona**: âœ…  
**Data/Ora**: 06/04/2026 14:32:15  
**DJ**: Luca (da localStorage)  
**Significato**: Coreografia COMPLETATA âœ…

---

## ðŸ’» CODICE AGGIORNATO - EVENTI.HTML

### Funzione: `salvaStato(id, stato, addTimestamp)`

```javascript
async function salvaStato(id, stato, addTimestamp = false) {
  const payload = {
    id,
    stato,
    dj: getDJLocal() || null
  };
  
  // âœ… Timestamp SOLO quando:
  //    - stato Ã¨ 'eseguito' 
  //    - addTimestamp flag Ã¨ true (dalla pagina prenotati)
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

### Funzione: `renderRows(brani, last)`

**Comportamento**:
1. Riceve solo brani "disponibili" (filtrati dal backend)
2. Per ogni brano:
   - Mostra icona â¬œ
   - Mostra 1 checkbox â†’ "Prenota"
   - Click â†’ salvaStato(..., 'prenotato', false)
3. Dopo il click:
   - Icona diventa ðŸŸ 
   - Checkbox disabilitato
   - Messaggio console: `ðŸŸ  [BRANO-1] disponibile â†’ prenotato`
   - Al prossimo polling (30 sec): brano scompare (perchÃ© filtro esclude prenotati)

---

## ðŸ“‹ FLUSSO OPERATIVO COMPLETO

```
T=00:00 - CARICAMENTO PAGINA PRINCIPALE
â”œâ”€ URL: http://localhost:3010/eventi/eventi.html
â”œâ”€ Console: "ðŸ“‹ Renderizzando 350 coreografie nel container"
â”œâ”€ Vedo: 350 brani con â¬œ e checkbox unchecked
â””â”€ DJ Ã¨ giÃ  selezionato da localStorage

T=00:05 - UTENTE SPUNTA UN BRANO
â”œâ”€ Click checkbox su "Toreador di Bizet"
â”œâ”€ Console: "ðŸŸ  [BRANO-1] disponibile â†’ prenotato (DJ: Luca, SENZA timestamp)"
â”œâ”€ Backend riceve: {id, stato: 'prenotato', dj: 'Luca', timestamp: null}
â”œâ”€ UI aggiorna:
â”‚  â”œâ”€ Icona: â¬œ â†’ ðŸŸ 
â”‚  â”œâ”€ Checkbox: unchecked â†’ checked 
â”‚  â”œâ”€ Row: abilitata â†’ disabilitata
â”‚  â””â”€ Console: "â„¹ï¸ Il brano scomparirÃ  da questa pagina"
â””â”€ Database aggiornato âœ…

T=00:06 - UTENTE NAVIGA A PRENOTATI.HTML
â”œâ”€ URL: http://localhost:3010/eventi/prenotati.html
â”œâ”€ Console: "ðŸŽ¬ renderLista() con filtro: prenotati"
â”œâ”€ Carica: API â†’ /brani + /log
â”œâ”€ Filtra: SOLO brani con stato "prenotato"
â”œâ”€ Vedo: 1 brano ðŸŸ  "Toreador di Bizet" con checkbox "Eseguito"
â””â”€ Checkbox Ã¨ abilitato, pronto al click

T=00:07 - UTENTE CLICCA "ESEGUITO" IN PRENOTATI
â”œâ”€ Click checkbox "Eseguito"
â”œâ”€ Console: "ðŸ“¤ Marcando come eseguito: BRANO-1"
â”œâ”€ Backend riceve: {id, stato: 'eseguito', timestamp: '2026-04-06T14:07:00Z'}
â”œâ”€ Database aggiornato
â””â”€ Pagina si ricarica (location.reload())

T=00:08 - PAGINA REFRESH - BRANO VISIBILE IN SPUNTATI
â”œâ”€ Brano NON Ã¨ piÃ¹ in prenotati.html (sparito dal polling)
â”œâ”€ Utente naviga a spuntati.html  
â”œâ”€ Vedo: 1 brano âœ… "Toreador di Bizet"
â”œâ”€ Timestamp: "06/04/2026, 14:07:00" â† âœ… PRESENTE!
â”œâ”€ DJ: "Luca" â† âœ… SALVATO!
â””â”€ Opzione "Annulla" per tornare disponibile (se necessario)
```

---

## ðŸŽ¯ VERIFICHE NEL BROWSER

### Console (F12 â†’ Console tab)

Quando spunti in eventi.html:
```
ðŸŸ  [BRANO-1] disponibile â†’ prenotato (DJ: Luca, SENZA timestamp)
   â„¹ï¸ Il brano scomparirÃ  da questa pagina
   â„¹ï¸ ApparirÃ  nella lista PRENOTATI
```

Quando clicchi "Eseguito" in prenotati.html:
```
ðŸ“¤ Marcando come eseguito: BRANO-1
```

### Database: log.json

**Dopo PRIMA SELEZIONE** (disponibile â†’ prenotato):
```json
{
  "id": "BRANO-1",
  "stato": "prenotato",
  "dj": "Luca",
  "timestamp": null
}
```

**Dopo SECONDA SELEZIONE** (prenotato â†’ eseguito):
```json
{
  "id": "BRANO-1",
  "stato": "eseguito",
  "dj": "Luca",
  "timestamp": "2026-04-06T14:07:00.123Z"
}
```

### UI: Icone Visibili

| Pagina | Stato | Icona | Momento |
|--------|-------|-------|---------|
| eventi.html | disponibile | â¬œ | Prima selezione |
| prenotati.html | prenotato | ðŸŸ  | Tra 2 selezioni |
| spuntati.html | eseguito | âœ… | Con data/ora |

---

## ðŸ“Œ NOTE IMPORTANTI

- Selezione DJ protetta: la scelta del DJ mostrata in `eventi.html` richiede ora la conferma tramite password di sistema (memorizzata in `Eventi/public/config.js` come `window.SYSTEM_PASSWORD`). Se la password inserita è errata o l'operatore annulla, la selezione viene ripristinata al valore precedente e il flusso continua senza modifiche.

1. **Timestamp SOLO a eseguito**: Non Ã¨ salvato quando prenotato
2. **DJ sempre salvato**: Dal primo click sulla localStorage
3. **Filtering automatico**: Le pagine mostrano SOLO lo stato relativo
4. **Polling ogni 30 sec**: I brani scompaiono/appaiono automaticamente
5. **Icone coerenti**: â¬œ ðŸŸ  âœ… in tutte le pagine
6. **Non reversibile da events.html**: Una volta prenotato, scompare da lÃ¬

---

## ðŸš€ AVVIO E TEST

```bash
# Termina server precedente (se attivo)
cd C:\VSC_Live_Server\Eventi
node server-eventi.js

# Browser
http://localhost:3010/eventi/eventi.html
```

**Test manuale**:
1. âœ… Seleziona DJ dal dropdown
2. âœ… Spunta un brano â†’ diventa ðŸŸ  (icona cambia)
3. âœ… Vai a prenotati.html â†’ vedi lo stesso brano con ðŸŸ 
4. âœ… Clicca "Eseguito" â†’ diventa âœ… con data/ora
5. âœ… Vai a spuntati.html â†’ vedi il brano âœ… con timestamp
6. âœ… Verifica console (F12) per i log dettagliati

---

## âœ¨ COERENZA CON VERSIONI PRECEDENTI

âœ… **Non modificato**: Backend, API, database schema  
âœ… **Retrocompatibile**: Nuovi log passano ugualmente  
âœ… **Logica finalmente corretta**: Flusso dei tre stati chiaro e intuitivo



