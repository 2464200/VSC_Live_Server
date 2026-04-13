# ✅ FLUSSO LOGICO CORRETTO - COREOGRAFIE PER STATI

**Data**: 6 Aprile 2026  
**Status**: 🟢 DEFINITIVO  
**Modifiche**: Solo `Eventi/public/eventi.js` (renderRows)

---

## 📊 ARCHITETTURA DELLE TRE PAGINE

```
┌────────────────────────────────────────────────────────────┐
│                    EVENTO DJ - 3 PAGINE                    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  PAGINA 1: eventi.html (⬜ DISPONIBILI)                    │
│  ├─ Mostra: SOLO brani con stato "disponibile"            │
│  ├─ Azione: Spunta checkbox → prenotato (🟠)              │
│  ├─ Timestamp: NO (null)                                   │
│  ├─ DJ: Salvato da localStorage                            │
│  └─ Dopo: Brano scompare dal polling (30 sec)             │
│                                                             │
│       ⬜ Brano 1 [☐ prenota]                               │
│       ⬜ Brano 2 [☐ prenota]                               │
│       ⬜ Brano 3 [☐ prenota]                               │
│                                                             │
│  👇 Utente spunta checkbox                                 │
│                                                             │
│  ─────────────────────────────────────────                 │
│                                                             │
│  PAGINA 2: prenotati.html (🟠 PRENOTATI)                  │
│  ├─ Mostra: SOLO brani con stato "prenotato"              │
│  ├─ Azione: Clicca "Eseguito" → eseguito (✅)             │
│  ├─ Azione alternativa: Clicca "Annulla" → torna disponibile│
│  ├─ Timestamp: SI (Date.now()) quando clicca               │
│  ├─ DJ: Salvato da localStorage                            │
│  └─ Dopo: Brano scompare dal polling (30 sec)             │
│                                                             │
│       🟠 Brano 1 [☐ Eseguito] [☐ Annulla]                 │
│       🟠 Brano 2 [☐ Eseguito] [☐ Annulla]                 │
│                                                             │
│  👇 Utente clicca "Eseguito"                               │
│                                                             │
│  ─────────────────────────────────────────                 │
│                                                             │
│  PAGINA 3: spuntati.html (✅ ESEGUITI)                    │
│  ├─ Mostra: SOLO brani con stato "eseguito"               │
│  ├─ Timestamp: SI (mostrato - es. 06/04/2026, 14:32:15)   │
│  ├─ DJ: Mostrato accanto a ogni brano                      │
│  ├─ Azione: Opzionale "Annulla" → torna disponibile        │
│  └─ Nota: Report definitivo completato                    │
│                                                             │
│       ✅ Brano 1 - 06/04/2026 14:32:15 [☐ Annulla]        │
│       ✅ Brano 2 - 06/04/2026 14:35:22 [☐ Annulla]        │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## 🔄 FLUSSO DETTAGLIATO DI UN BRANO

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
**Icona**: ⬜  
**Checkbox UI**: Unchecked, abilitato  

👇 **Utente spunta in eventi.html**

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
**Visualizzato in**: `prenotati.html` (NON più in eventi.html)  
**Icona**: 🟠  
**Checkbox UI**: Unchecked (negli altri brani), ma questo ha checkbox "Eseguito"  
**Significato**: Brano PRENOTATO - Nessun altro DJ può selezionarlo  

👇 **Utente clicca "Eseguito" in prenotati.html**

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
**Icona**: ✅  
**Data/Ora**: 06/04/2026 14:32:15  
**DJ**: Luca (da localStorage)  
**Significato**: Coreografia COMPLETATA ✅

---

## 💻 CODICE AGGIORNATO - EVENTI.HTML

### Funzione: `salvaStato(id, stato, addTimestamp)`

```javascript
async function salvaStato(id, stato, addTimestamp = false) {
  const payload = {
    id,
    stato,
    dj: getDJLocal() || null
  };
  
  // ✅ Timestamp SOLO quando:
  //    - stato è 'eseguito' 
  //    - addTimestamp flag è true (dalla pagina prenotati)
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
   - Mostra icona ⬜
   - Mostra 1 checkbox → "Prenota"
   - Click → salvaStato(..., 'prenotato', false)
3. Dopo il click:
   - Icona diventa 🟠
   - Checkbox disabilitato
   - Messaggio console: `🟠 [BRANO-1] disponibile → prenotato`
   - Al prossimo polling (30 sec): brano scompare (perché filtro esclude prenotati)

---

## 📋 FLUSSO OPERATIVO COMPLETO

```
T=00:00 - CARICAMENTO PAGINA PRINCIPALE
├─ URL: http://localhost:3010/eventi/eventi.html
├─ Console: "📋 Renderizzando 350 coreografie nel container"
├─ Vedo: 350 brani con ⬜ e checkbox unchecked
└─ DJ è già selezionato da localStorage

T=00:05 - UTENTE SPUNTA UN BRANO
├─ Click checkbox su "Toreador di Bizet"
├─ Console: "🟠 [BRANO-1] disponibile → prenotato (DJ: Luca, SENZA timestamp)"
├─ Backend riceve: {id, stato: 'prenotato', dj: 'Luca', timestamp: null}
├─ UI aggiorna:
│  ├─ Icona: ⬜ → 🟠
│  ├─ Checkbox: unchecked → checked 
│  ├─ Row: abilitata → disabilitata
│  └─ Console: "ℹ️ Il brano scomparirà da questa pagina"
└─ Database aggiornato ✅

T=00:06 - UTENTE NAVIGA A PRENOTATI.HTML
├─ URL: http://localhost:3010/eventi/prenotati.html
├─ Console: "🎬 renderLista() con filtro: prenotati"
├─ Carica: API → /brani + /log
├─ Filtra: SOLO brani con stato "prenotato"
├─ Vedo: 1 brano 🟠 "Toreador di Bizet" con checkbox "Eseguito"
└─ Checkbox è abilitato, pronto al click

T=00:07 - UTENTE CLICCA "ESEGUITO" IN PRENOTATI
├─ Click checkbox "Eseguito"
├─ Console: "📤 Marcando come eseguito: BRANO-1"
├─ Backend riceve: {id, stato: 'eseguito', timestamp: '2026-04-06T14:07:00Z'}
├─ Database aggiornato
└─ Pagina si ricarica (location.reload())

T=00:08 - PAGINA REFRESH - BRANO VISIBILE IN SPUNTATI
├─ Brano NON è più in prenotati.html (sparito dal polling)
├─ Utente naviga a spuntati.html  
├─ Vedo: 1 brano ✅ "Toreador di Bizet"
├─ Timestamp: "06/04/2026, 14:07:00" ← ✅ PRESENTE!
├─ DJ: "Luca" ← ✅ SALVATO!
└─ Opzione "Annulla" per tornare disponibile (se necessario)
```

---

## 🎯 VERIFICHE NEL BROWSER

### Console (F12 → Console tab)

Quando spunti in eventi.html:
```
🟠 [BRANO-1] disponibile → prenotato (DJ: Luca, SENZA timestamp)
   ℹ️ Il brano scomparirà da questa pagina
   ℹ️ Apparirà nella lista PRENOTATI
```

Quando clicchi "Eseguito" in prenotati.html:
```
📤 Marcando come eseguito: BRANO-1
```

### Database: log.json

**Dopo PRIMA SELEZIONE** (disponibile → prenotato):
```json
{
  "id": "BRANO-1",
  "stato": "prenotato",
  "dj": "Luca",
  "timestamp": null
}
```

**Dopo SECONDA SELEZIONE** (prenotato → eseguito):
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
| eventi.html | disponibile | ⬜ | Prima selezione |
| prenotati.html | prenotato | 🟠 | Tra 2 selezioni |
| spuntati.html | eseguito | ✅ | Con data/ora |

---

## 📌 NOTE IMPORTANTI

1. **Timestamp SOLO a eseguito**: Non è salvato quando prenotato
2. **DJ sempre salvato**: Dal primo click sulla localStorage
3. **Filtering automatico**: Le pagine mostrano SOLO lo stato relativo
4. **Polling ogni 30 sec**: I brani scompaiono/appaiono automaticamente
5. **Icone coerenti**: ⬜ 🟠 ✅ in tutte le pagine
6. **Non reversibile da events.html**: Una volta prenotato, scompare da lì

---

## 🚀 AVVIO E TEST

```bash
# Termina server precedente (se attivo)
cd C:\VSC_Live_Server\Eventi
node server-eventi.js

# Browser
http://localhost:3010/eventi/eventi.html
```

**Test manuale**:
1. ✅ Seleziona DJ dal dropdown
2. ✅ Spunta un brano → diventa 🟠 (icona cambia)
3. ✅ Vai a prenotati.html → vedi lo stesso brano con 🟠
4. ✅ Clicca "Eseguito" → diventa ✅ con data/ora
5. ✅ Vai a spuntati.html → vedi il brano ✅ con timestamp
6. ✅ Verifica console (F12) per i log dettagliati

---

## ✨ COERENZA CON VERSIONI PRECEDENTI

✅ **Non modificato**: Backend, API, database schema  
✅ **Retrocompatibile**: Nuovi log passano ugualmente  
✅ **Logica finalmente corretta**: Flusso dei tre stati chiaro e intuitivo
