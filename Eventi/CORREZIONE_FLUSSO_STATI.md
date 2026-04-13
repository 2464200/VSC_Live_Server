# ✅ CORREZIONE LOGICA FLUSSO STATI COREOGRAFIE

**Data**: 6 Aprile 2026  
**Scope**: Revisione logica di transizione stato eventi.js  
**Status**: 🟢 COMPLETATO

---

## 🔴 PROBLEMA IDENTIFICATO

La logica di transizione dello stato usava **DUE CHECKBOX SEPARATI**:
- `checkbox-prenota`: disponibile ↔ prenotato
- `checkbox-eseguito`: prenotato ↔ eseguito

Il timestamp veniva **sempre aggiunto** (anche per stato "prenotato"), violando il flusso corretto:
- Prima spunta: disponibile → **prenotato** (SENZA timestamp)
- Seconda spunta: prenotato → **eseguito** (CON timestamp)

---

## ✅ SOLUZIONE IMPLEMENTATA

### 1. **Funzione `salvaStato()` - Aggiornata**

```javascript
async function salvaStato(id, stato, addTimestamp = false) {
  const payload = {
    id,
    stato,
    dj: getDJLocal() || null
  };
  
  // ✅ Timestamp SOLO quando stato è 'eseguito' E addTimestamp=true
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
- Il DJ viene sempre salvato (dalla localStorage)

---

### 2. **Funzione `renderRows()` - Completamente Rivista**

**Nuovo flusso**: **UN UNICO CHECKBOX** con logica a tre stati

```
┌─────────────────────────────────────────────────────────┐
│ FLUSSO A TRE STATI - UN UNICO CHECKBOX                  │
├─────────────────────────────────────────────────────────┤
│ Stato: DISPONIBILE  ╱ checkbox: unchecked, abilitato    │
│   └─ Utente spunta  │                                    │
│        └─→ PRENOTATO  ╱ checkbox: checked, abilitato    │
│             (SENZA timestamp)      │                     │
│   └─ Utente spunta di nuovo        │                     │
│        └─→ ESEGUITO  ╱ checkbox: checked, DISABLED      │
│             (CON timestamp, data/ora aggiunta)           │
│                                                          │
│ Terminal: "✅ [id] prenotato → eseguito (CON timestamp)"│
└─────────────────────────────────────────────────────────┘
```

### 3. **Event Listener - Logica Corretta**

```javascript
checkbox.addEventListener('change', async () => {
  const currentState = normalizeState(last.get(brano.id)?.stato);
  let newState;
  let includeTimestamp = false;

  if (currentState === 'disponibile') {
    // ✅ PRIMA SPUNTA: disponibile → prenotato (SENZA timestamp)
    newState = 'prenotato';
    includeTimestamp = false;
    console.log(`📌 [${brano.id}] disponibile → prenotato (SENZA timestamp)`);
  } else if (currentState === 'prenotato') {
    // ✅ SECONDA SPUNTA: prenotato → eseguito (CON timestamp)
    newState = 'eseguito';
    includeTimestamp = true;
    console.log(`✅ [${brano.id}] prenotato → eseguito (CON timestamp di ${getDJLocal()})`);
  }

  // Salva con il flag corretto
  await salvaStato(brano.id, newState, includeTimestamp);
});
```

---

## 🔍 FLUSSO OPERATIVO COMPLETO

### Scenario: Prenotare e Eseguire un Brano

```
1️⃣ CARICO PAGINA principais (eventi.html)
   └─ Console: "📋 Renderizzando 557 coreografie nel container"
   └─ Vedo: ⬜ [Brano1] [checkbox UNCHECKED]
   
2️⃣ UTENTE SPUNTA IL CHECKBOX PRIMA VOLTA
   └─ Event: checkbox.change triggered
   └─ Logica: currentState='disponibile' → newState='prenotato'
   └─ Console: "📌 [id] disponibile → prenotato (SENZA timestamp)"
   └─ Salva: salvaStato(id, 'prenotato', false)
      └─ Payload: {id, stato: 'prenotato', dj: 'DJ Name', timestamp: null}
   └─ UI Aggiorna: riga diventa GIALLA (classe 'prenotato')
   
3️⃣ UTENTE SPUNTA IL CHECKBOX LA SECONDA VOLTA
   └─ Event: checkbox.change triggered di nuovo
   └─ Logica: currentState='prenotato' → newState='eseguito'  
   └─ Console: "✅ [id] prenotato → eseguito (CON timestamp di DJ Name)"
   └─ Salva: salvaStato(id, 'eseguito', true)
      └─ Payload: {id, stato: 'eseguito', dj: 'DJ Name', timestamp: '2026-04-06 14:32:15'}
   └─ UI Aggiorna: 
      ├─ riga diventa VERDE (classe 'eseguito')
      ├─ timestamp appare nella riga: "06/04/2026, 14:32:15"
      └─ checkbox diventa DISABLED (non può più cambiare)

4️⃣ POLLING AGGIORNA (ogni 30 secondi)
   └─ Ricarica dati dal database
   └─ Lo stato rimane 'eseguito' con timestamp
   └─ UI rimane coerente
```

---

## 🎯 VERIFICA NEL BROWSER

### Console (F12 → Console tab)

Dovresti vedere questi log quando spunti il checkbox:

```
📌 [BRANO-123] disponibile → prenotato (SENZA timestamp)
```

Poi quando lo spunti di nuovo:

```
✅ [BRANO-123] prenotato → eseguito (CON timestamp di Luca)
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

## 📋 FILE MODIFICATI

✅ **`Eventi/public/eventi.js`**
- ✅ Funzione `salvaStato()`: aggiunto parametro `addTimestamp`
- ✅ Funzione `renderRows()`: sostituito doppio checkbox con uno singolo
- ✅ Event listener: logica a tre stati (disponibile → prenotato → eseguito)
- ✅ Timestamp aggiunto SOLO quando stato = 'eseguito'

**NON MODIFICATI** (funzionano benissimo):
- ❌ `Eventi/public/api-helper.js`
- ❌ `Eventi/public/render.js`
- ❌ `Eventi/server-eventi.js`
- ❌ HTML template

---

## 🚀 TEST & DEPLOYMENT

```bash
# Server già online
http://localhost:3010/eventi/eventi.html

# Test manuale:
1. Apri pagina
2. Seleziona un DJ dal dropdown
3. Spunta un brano: vedi "prenotato" SENZA data
4. Spunta di nuovo: vedi "eseguito" CON data/ora del DJ
5. Non puoi più cambiare (checkbox disabled)
```

---

## ✨ MIGLIORAMENTI

| Aspetto | Prima | Dopo |
|---------|-------|------|
| **N. Checkbox** | 2 (confusi) | 1 (chiaro) |
| **Timestamp** | Sempre | Solo "eseguito" |
| **Flusso logico** | Ambiguo | Chiaro: 3 stati |
| **UX** | Confusa | Intuitiva |
| **Debug** | Nessun log | Console dettagliata |

---

## 🔗 RELAZIONE CON FUNZIONAMENTI PRECEDENTI

Il comportamento ora è **coerente** con come dovrebbe funzionare:
- ✅ Pagine di filtro (render.js): conservate come erano
- ✅ API backend: nessun cambiamento
- ✅ Database schema: retrocompatibile
- ✅ Logica stato: finalmente corretta
