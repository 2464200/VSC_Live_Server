# ✅ BORDERÒ - Quick Test Guide

> 📌 Questa documentazione fa parte della [guida unificata del progetto](README.md).


## 🧪 Come Testare il Sistema Fisso

### **Test 1: Admin Panel File Selection (5 min)**

1. **Apri Admin Panel:**
   ```
   http://localhost:8000/Bordero/pages/admin.html
   ```

2. **Verifica System Status:**
   - Browser: ✅ Dovrebbe mostrare qualcosa come "Chrome/120"
   - localStorage: ✅ Dovrebbe mostrare MB disponibili
   - Last Sync: ✅ Se mai sincronizzato prima
   - Cache Size: ✅ Numero di chiavi cache

3. **Seleziona File Excel:**
   - Clicca: **"📁 Seleziona File Excel..."**
   - Finestra di dialogo file si apre
   - Naviga a: `C:\VSC_Live_Server - WEB\Excel\`
   - Seleziona: `Borderò - ver 13.1.69_con AutoHotkey da sistemare.xlsm`
   - Clicca: **"Apri"**

4. **Verifica Caricamento:**
   - Dovrebbe comparire: `✓ File selezionato: Borderò... (X.X MB)`
   - Colore del testo: **verde** (#28a745)
   - Console (F12): Leggi i log

5. **Sincronizza Tutto:**
   - Clicca: **"🔄 Sincronizza Tutto da Excel"**
   - Attendi 2-3 secondi
   - Dovresti vedere Toast: `"✓ Dati sincronizzati da Excel"`

6. **Verifica Dati nella Cache:**
   - Scroll down fino a: **"📋 Data Viewer"**
   - Seleziona dal dropdown: **"Brani (Songs)"**
   - Dovrebbe comparire tabella con 20+ righe
   - Colonne: ID, Titolo, Autore, Coreografo, Genere, ecc.

### **Test 2: Bordero Pagina Principale (5 min)**

1. **Apri Bordero:**
   ```
   http://localhost:8000/Bordero/pages/bordero.html
   ```

2. **Verifica Caricamento Dati:**
   - Tabella non vuota: ✅ Dovrebbe avere 20+ righe
   - DJ dropdown: ✅ Dovrebbe avere 3+ opzioni
   - Location dropdown: ✅ Dovrebbe avere 7+ opzioni
   - Toast success: ✅ "Caricati XXX brani"

3. **Testa Sort:**
   - Click header colonna "GENERE"
   - Le righe dovrebbero riordinarsi alfabeticamente
   - Click di nuovo: ordine inverso

4. **Testa Search:**
   - Digita in search box: `"House"`
   - Tabella dovrebbe mostrare solo brani con "House" in titolo/autore
   - Cancella text: torna a mostrare tutti

5. **Testa Mark Complete:**
   - Click su una riga (qualunque brano)
   - La riga dovrebbe:
     - Diventare grigia (opacity ridotta)
     - Aggiungere una "X" nella prima colonna
     - Mostrare timestamp
     - Scivolare in fondo

6. **Testa Export SIAE:**
   - Click: "💾 Export SIAE"
   - File CSV dovrebbe scaricarsi nel browser
   - Nome: qualcosa tipo `siae_export_2026_06_18.csv`

### **Test 3: NextCoreo Display (3 min)**

1. **Apri NextCoreo:**
   ```
   http://localhost:8000/Bordero/pages/next-coreo.html
   ```

2. **Verifica Fullscreen:**
   - Dovrebbe mostrare il brano corrente grande
   - Se primo mark, dovrebbe mostrare il primo brano
   - Clicca "⛶ Fullscreen" per vero fullscreen (F11)

3. **Live Sync Test:**
   - Apri due tab/finestre:
     - Tab 1: bordero.html
     - Tab 2: next-coreo.html
   - In Tab 1: marca un brano
   - In Tab 2: dovrebbe aggiornare automaticamente (entro 1-2 secondi)

### **Test 4: Browser Console (F12) - (3 min)**

1. **Apri Dev Tools:**
   ```
   F12 → Console tab
   ```

2. **Esegui test commands:**
   
   ```javascript
   // Test 1: Verifica XLSX caricato
   console.log(typeof XLSX);  // Dovrebbe essere: "object"
   
   // Test 2: Verifica excelFileManager
   console.log(typeof excelFileManager);  // Dovrebbe essere: "object"
   
   // Test 3: Verifica excelSync
   console.log(typeof excelSync);  // Dovrebbe essere: "object"
   
   // Test 4: Verifica brani in cache
   const brani = JSON.parse(localStorage.getItem('BORDERO_BRANI_DATA'));
   console.log(`Brani caricati: ${brani?.length || 0}`);
   // Dovrebbe mostrare: "Brani caricati: 20+" (o numero effettivo)
   
   // Test 5: Verifica comuni in cache
   const comuni = JSON.parse(localStorage.getItem('BORDERO_COMUNI_DATA'));
   console.log(`Comuni caricati: ${comuni?.length || 0}`);
   
   // Test 6: Verifica DJ in cache
   const dj = JSON.parse(localStorage.getItem('BORDERO_DBASE_DATA'));
   console.log(`DJ caricati: ${dj?.length || 0}`);
   
   // Test 7: Vedi tutti i keys di cache
   Object.keys(localStorage).filter(k => k.startsWith('BORDERO_'))
   // Dovrebbe mostrare array di keys come:
   // ["BORDERO_BRANI_DATA", "BORDERO_COMUNI_DATA", "BORDERO_DBASE_DATA", ...]
   ```

3. **Risultati Attesi:**
   - No red errors
   - Tutti i typeof ritornano "object"
   - Brani: 20+ (numero effettivo da Excel)
   - Comuni: 7+ (numero effettivo da Excel)
   - DJ: 3+ (numero effettivo da Excel)

---

## 📋 Checklist di Test

```
ADMIN PANEL
☐ System Status carica correttamente
☐ Pulsante "Seleziona File Excel" è visibile
☐ Dialogo file si apre quando clicco
☐ File Excel si carica e mostra nome/size
☐ "Sincronizza Tutto" funziona
☐ Toast success compare quando sync OK
☐ Data Viewer mostra dati

BORDERO TABELLA
☐ Tabella non è vuota (20+ brani)
☐ DJ dropdown è popolato
☐ Location dropdown è popolato
☐ Sort funziona (click header)
☐ Search funziona
☐ Mark complete funziona (X appare, riga grays)
☐ Export SIAE scarica file

NEXT-COREO
☐ Pagina carica fullscreen
☐ Mostra brano
☐ Auto-update quando marco in bordero

CONSOLE (F12)
☐ No red errors
☐ XLSX è object
☐ excelFileManager è object
☐ excelSync è object
☐ Brani nel localStorage
☐ Comuni nel localStorage
☐ DJ nel localStorage
☐ Timestamp sync update

OFFLINE TEST
☐ Clear cache (admin → Clear All)
☐ Ricarica bordero
☐ Verifica fallback a CSV
☐ Dati dovrebbero ancora comparire
```

---

## 🚨 Se Qualcosa Non Funziona

### **Errore: "XLSX is not defined"**
- [ ] Ricarica pagina (F5)
- [ ] Aspetta 2 secondi
- [ ] Verifica F12 → Network → cerca "xlsx"
- [ ] Se non c'è, il CDN non accessibile
  - **Soluzione:** Scarica xlsx.min.js localmente e includi come `<script src="../js/xlsx.min.js"></script>`

### **File Dialog Non Appare**
- [ ] Controlla permessi browser per file dialog
- [ ] Prova con Chrome vs Firefox
- [ ] Verifica console per errori

### **Tabella Vuota**
- [ ] Verifica che file Excel sia stato selezionato
- [ ] Clicca "Sincronizza Tutto" di nuovo
- [ ] Guarda F12 → Console per errori
- [ ] Controlla che il file sia il file corretto

### **Dropdown Vuoti**
- [ ] Admin → Sincronizza dBase
- [ ] Admin → Sincronizza Comuni
- [ ] Ricaricare bordero.html
- [ ] F12 → Console → verifica comuni e DJ in cache

### **Export Non Funziona**
- [ ] Controlla che browser permetta download
- [ ] Verifica blocco popup/download
- [ ] Controlla dimensione file (non dovrebbe essere > 5MB)

---

## ⏱️ Timing Atteso

| Operazione | Tempo |
|-----------|-------|
| Caricamento Admin Panel | <1 sec |
| Dialogo File | Instant |
| Lettura File Excel | 1-2 sec |
| Sincronizzazione | 2-3 sec |
| Caricamento Bordero | <2 sec |
| Sort/Search | <100ms |
| Mark Complete | <50ms |
| Export CSV | <500ms |
| NextCoreo Refresh | 1 sec |

---

## 📊 Expected Data Counts

**Dai file Excel dovrebbero comparire:**

| Dataset | Conteggio | Origine |
|---------|-----------|---------|
| Brani | 20+ | "Elenco Brani (statico)" |
| Comuni | 7+ | "Comuni Italia" |
| DJ | 3+ | "dBase" |

Se i numeri sono diversi:
- Il file Excel non ha dati
- I nomi dei fogli sono diversi (controlla `excel-sync.js`)
- Il file non è sincronizzato correttamente

---

## 🎯 Success Criteria

Il sistema funziona correttamente se:

1. ✅ File Excel selezionabile via dialogo
2. ✅ Dati sincronizzati automaticamente
3. ✅ Tabella mostra 20+ brani
4. ✅ Dropdown popolati (DJ + Comuni)
5. ✅ Sort, Search, Filter funzionano
6. ✅ Mark Complete aggiunge X + timestamp
7. ✅ Export SIAE scarica CSV
8. ✅ NextCoreo aggiorna live
9. ✅ Nessun errore console (rosso)
10. ✅ localStorage contiene dati

**Se tutti questi punti sono ✅, il sistema è PERFETTO!**

---

## 📝 Report Template

Se c'è un problema, fornisci:

```
**Problema:** [Descrivi il problema]
**Browser:** [Chrome/Firefox/Edge/Safari]
**OS:** [Windows/Mac/Linux]
**URL:** [Quale URL stai testando]
**Passi per Riprodurre:**
1. [Passo 1]
2. [Passo 2]
3. [Passo 3]
**Errore Visto:** [Messaggio di errore, screenshot, F12 log]
**Expected:** [Cosa dovrebbe succedere]
```

---

**Status:** ✅ **Test Completo**  
**Data:** 2026-06-18  
**Tempo Totale Test:** ~15-20 minuti

