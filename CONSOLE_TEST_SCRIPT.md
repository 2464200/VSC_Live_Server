# ðŸ§ª CONSOLE TEST SCRIPT

> ðŸ“Œ Questa documentazione fa parte della [guida unificata del progetto](README.md).


Copia e incolla questi comandi uno alla volta nella **Console del Browser (F12)**

## Test 1: Verifica Librerie Caricate

```javascript
console.log('=== TEST 1: Librerie ===');
console.log('XLSX caricato?', typeof XLSX === 'object' ? 'âœ… YES' : 'âŒ NO');
console.log('excelFileManager?', typeof excelFileManager === 'object' ? 'âœ… YES' : 'âŒ NO');
console.log('excelSync?', typeof excelSync === 'object' ? 'âœ… YES' : 'âŒ NO');
console.log('Storage?', typeof Storage === 'object' ? 'âœ… YES' : 'âŒ NO');
console.log('logger?', typeof logger === 'object' ? 'âœ… YES' : 'âŒ NO');
```

**Risultato Atteso:** Tutti âœ… YES

---

## Test 2: Verifica File Selezionato

```javascript
console.log('=== TEST 2: File Selezionato ===');
console.log('excelSync.excelFile:', excelSync.excelFile);
console.log('File selezionato?', excelSync.excelFile ? 'âœ… YES' : 'âŒ NO');
if (excelSync.excelFile) {
  console.log('Nome file:', excelSync.excelFile.name);
  console.log('Dimensione:', excelSync.excelFile.size, 'bytes');
}
```

**Se âŒ NO:** Clicca il pulsante "ðŸ“ Seleziona File Excel" nel admin.html

---

## Test 3: Leggi File Excel e Mostra Fogli

```javascript
console.log('=== TEST 3: Lettura File Excel ===');
(async () => {
  if (!excelSync.excelFile) {
    console.log('âŒ Nessun file selezionato');
    return;
  }
  
  try {
    const arrayBuffer = await excelSync.excelFile.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    console.log('âœ… File letto correttamente');
    console.log('Numero fogli:', workbook.SheetNames.length);
    console.log('Nomi fogli:', workbook.SheetNames);
    
    // Mostra quante righe in ogni foglio
    workbook.SheetNames.forEach(name => {
      const sheet = workbook.Sheets[name];
      const data = XLSX.utils.sheet_to_json(sheet);
      console.log(`  "${name}": ${data.length} righe`);
    });
  } catch (error) {
    console.error('âŒ Errore lettura file:', error);
  }
})();
```

**Risultato Atteso:** 
- âœ… File letto correttamente
- Fogli trovati con nomi esatti:
  - "Elenco Brani (statico)"
  - "Comuni Italia"
  - "dBase"

---

## Test 4: Sincronizza BRANI Manualmente

```javascript
console.log('=== TEST 4: Sincronizza BRANI ===');
(async () => {
  if (!excelSync.excelFile) {
    console.log('âŒ Nessun file selezionato');
    return;
  }
  
  try {
    const arrayBuffer = await excelSync.excelFile.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    const result = await excelSync.syncBrani(workbook);
    
    console.log('Sync completato:', result ? 'âœ… SUCCESS' : 'âŒ FAILED');
    
    // Verifica cache
    const brani = JSON.parse(localStorage.getItem('BORDERO_BRANI_DATA'));
    console.log('Brani in cache:', brani?.length || 0);
    if (brani?.length > 0) {
      console.log('Primo brano:', brani[0]);
    }
  } catch (error) {
    console.error('âŒ Errore:', error);
  }
})();
```

**Risultato Atteso:**
- âœ… SUCCESS
- Brani in cache: > 0 (numero effettivo)
- Primo brano: mostra oggetto con dati

---

## Test 5: Sincronizza COMUNI Manualmente

```javascript
console.log('=== TEST 5: Sincronizza COMUNI ===');
(async () => {
  if (!excelSync.excelFile) {
    console.log('âŒ Nessun file selezionato');
    return;
  }
  
  try {
    const arrayBuffer = await excelSync.excelFile.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    const result = await excelSync.syncComuni(workbook);
    
    console.log('Sync completato:', result ? 'âœ… SUCCESS' : 'âŒ FAILED');
    
    // Verifica cache
    const comuni = JSON.parse(localStorage.getItem('BORDERO_COMUNI_DATA'));
    console.log('Comuni in cache:', comuni?.length || 0);
    if (comuni?.length > 0) {
      console.log('Primo comune:', comuni[0]);
    }
  } catch (error) {
    console.error('âŒ Errore:', error);
  }
})();
```

---

## Test 6: Sincronizza DBASE Manualmente

```javascript
console.log('=== TEST 6: Sincronizza DBASE ===');
(async () => {
  if (!excelSync.excelFile) {
    console.log('âŒ Nessun file selezionato');
    return;
  }
  
  try {
    const arrayBuffer = await excelSync.excelFile.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    const result = await excelSync.syncDBase(workbook);
    
    console.log('Sync completato:', result ? 'âœ… SUCCESS' : 'âŒ FAILED');
    
    // Verifica cache
    const dj = JSON.parse(localStorage.getItem('BORDERO_DBASE_DATA'));
    console.log('DJ in cache:', dj?.length || 0);
    if (dj?.length > 0) {
      console.log('Primo DJ:', dj[0]);
    }
  } catch (error) {
    console.error('âŒ Errore:', error);
  }
})();
```

---

## Test 7: Verifica localStorage Completo

```javascript
console.log('=== TEST 7: localStorage ===');
const keys = Object.keys(localStorage).filter(k => k.startsWith('BORDERO_'));
console.log('Chiavi BORDERO_ in cache:', keys.length);
keys.forEach(key => {
  const value = localStorage.getItem(key);
  const size = (value.length / 1024).toFixed(2);
  console.log(`  ${key}: ${size} KB`);
});

// Resumo
const brani = JSON.parse(localStorage.getItem('BORDERO_BRANI_DATA')) || [];
const comuni = JSON.parse(localStorage.getItem('BORDERO_COMUNI_DATA')) || [];
const dj = JSON.parse(localStorage.getItem('BORDERO_DBASE_DATA')) || [];

console.log('\n=== SUMMARY ===');
console.log('âœ… Brani:', brani.length);
console.log('âœ… Comuni:', comuni.length);
console.log('âœ… DJ:', dj.length);
console.log('Total cache:', keys.length, 'keys');
```

---

## Test 8: Test Admin Panel Functions

```javascript
console.log('=== TEST 8: Admin Panel ===');

// Verifica che AdminPanel sia caricato
if (typeof adminPanel === 'undefined') {
  console.log('âš ï¸ AdminPanel non ancora inizializzato');
} else {
  console.log('âœ… AdminPanel caricato');
  console.log('Method log?', typeof adminPanel.log === 'function' ? 'âœ…' : 'âŒ');
  console.log('Method setupDataSync?', typeof adminPanel.setupDataSync === 'function' ? 'âœ…' : 'âŒ');
}
```

---

## ðŸš€ Quick Full Test (Copia Tutto)

```javascript
console.clear();
console.log('=== BORDERÃ’ EXCEL SYNC - FULL TEST ===\n');

// 1. Librerie
console.log('1ï¸âƒ£ Librerie Caricate:');
console.log('  XLSX:', typeof XLSX === 'object' ? 'âœ…' : 'âŒ');
console.log('  excelSync:', typeof excelSync === 'object' ? 'âœ…' : 'âŒ');
console.log('  excelFileManager:', typeof excelFileManager === 'object' ? 'âœ…' : 'âŒ');

// 2. File
console.log('\n2ï¸âƒ£ File Selezionato:');
console.log('  Caricato?', excelSync.excelFile ? 'âœ… ' + excelSync.excelFile.name : 'âŒ NESSUNO');

// 3. Cache
console.log('\n3ï¸âƒ£ Cache:');
const brani = JSON.parse(localStorage.getItem('BORDERO_BRANI_DATA')) || [];
const comuni = JSON.parse(localStorage.getItem('BORDERO_COMUNI_DATA')) || [];
const dj = JSON.parse(localStorage.getItem('BORDERO_DBASE_DATA')) || [];
console.log('  Brani:', brani.length > 0 ? 'âœ… ' + brani.length : 'âŒ 0');
console.log('  Comuni:', comuni.length > 0 ? 'âœ… ' + comuni.length : 'âŒ 0');
console.log('  DJ:', dj.length > 0 ? 'âœ… ' + dj.length : 'âŒ 0');

// 4. Risultato
console.log('\n4ï¸âƒ£ RISULTATO COMPLESSIVO:');
if (brani.length > 0 && comuni.length > 0 && dj.length > 0) {
  console.log('  âœ…âœ…âœ… TUTTO FUNZIONA PERFETTAMENTE! âœ…âœ…âœ…');
} else {
  console.log('  âš ï¸ Alcuni dati mancano - Tenta la sincronizzazione');
}
```

---

## ðŸ“‹ Checklist Final

- [ ] Test 1: Tutte le librerie âœ…
- [ ] Test 2: File selezionato âœ…
- [ ] Test 3: File leggibile e fogli trovati âœ…
- [ ] Test 4: Brani sincronizzati âœ…
- [ ] Test 5: Comuni sincronizzati âœ…
- [ ] Test 6: dBase sincronizzato âœ…
- [ ] Test 7: Cache completo âœ…
- [ ] Test 8: Admin Panel funzionante âœ…

Se tutti âœ… â†’ **SISTEMA PERFETTO!** ðŸŽ‰

---

**Come usare questi test:**
1. Apri: http://localhost:5500/Bordero/pages/admin.html
2. Premi: **F12** (Dev Tools)
3. Vai al tab: **Console**
4. Copia uno dei test script sopra
5. Incolla in console
6. Premi: **ENTER**
7. Leggi i risultati

**Tempo totale:** ~5 minuti per il test completo



