# 🧪 CONSOLE TEST SCRIPT

Copia e incolla questi comandi uno alla volta nella **Console del Browser (F12)**

## Test 1: Verifica Librerie Caricate

```javascript
console.log('=== TEST 1: Librerie ===');
console.log('XLSX caricato?', typeof XLSX === 'object' ? '✅ YES' : '❌ NO');
console.log('excelFileManager?', typeof excelFileManager === 'object' ? '✅ YES' : '❌ NO');
console.log('excelSync?', typeof excelSync === 'object' ? '✅ YES' : '❌ NO');
console.log('Storage?', typeof Storage === 'object' ? '✅ YES' : '❌ NO');
console.log('logger?', typeof logger === 'object' ? '✅ YES' : '❌ NO');
```

**Risultato Atteso:** Tutti ✅ YES

---

## Test 2: Verifica File Selezionato

```javascript
console.log('=== TEST 2: File Selezionato ===');
console.log('excelSync.excelFile:', excelSync.excelFile);
console.log('File selezionato?', excelSync.excelFile ? '✅ YES' : '❌ NO');
if (excelSync.excelFile) {
  console.log('Nome file:', excelSync.excelFile.name);
  console.log('Dimensione:', excelSync.excelFile.size, 'bytes');
}
```

**Se ❌ NO:** Clicca il pulsante "📁 Seleziona File Excel" nel admin.html

---

## Test 3: Leggi File Excel e Mostra Fogli

```javascript
console.log('=== TEST 3: Lettura File Excel ===');
(async () => {
  if (!excelSync.excelFile) {
    console.log('❌ Nessun file selezionato');
    return;
  }
  
  try {
    const arrayBuffer = await excelSync.excelFile.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    console.log('✅ File letto correttamente');
    console.log('Numero fogli:', workbook.SheetNames.length);
    console.log('Nomi fogli:', workbook.SheetNames);
    
    // Mostra quante righe in ogni foglio
    workbook.SheetNames.forEach(name => {
      const sheet = workbook.Sheets[name];
      const data = XLSX.utils.sheet_to_json(sheet);
      console.log(`  "${name}": ${data.length} righe`);
    });
  } catch (error) {
    console.error('❌ Errore lettura file:', error);
  }
})();
```

**Risultato Atteso:** 
- ✅ File letto correttamente
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
    console.log('❌ Nessun file selezionato');
    return;
  }
  
  try {
    const arrayBuffer = await excelSync.excelFile.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    const result = await excelSync.syncBrani(workbook);
    
    console.log('Sync completato:', result ? '✅ SUCCESS' : '❌ FAILED');
    
    // Verifica cache
    const brani = JSON.parse(localStorage.getItem('BORDERO_BRANI_DATA'));
    console.log('Brani in cache:', brani?.length || 0);
    if (brani?.length > 0) {
      console.log('Primo brano:', brani[0]);
    }
  } catch (error) {
    console.error('❌ Errore:', error);
  }
})();
```

**Risultato Atteso:**
- ✅ SUCCESS
- Brani in cache: > 0 (numero effettivo)
- Primo brano: mostra oggetto con dati

---

## Test 5: Sincronizza COMUNI Manualmente

```javascript
console.log('=== TEST 5: Sincronizza COMUNI ===');
(async () => {
  if (!excelSync.excelFile) {
    console.log('❌ Nessun file selezionato');
    return;
  }
  
  try {
    const arrayBuffer = await excelSync.excelFile.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    const result = await excelSync.syncComuni(workbook);
    
    console.log('Sync completato:', result ? '✅ SUCCESS' : '❌ FAILED');
    
    // Verifica cache
    const comuni = JSON.parse(localStorage.getItem('BORDERO_COMUNI_DATA'));
    console.log('Comuni in cache:', comuni?.length || 0);
    if (comuni?.length > 0) {
      console.log('Primo comune:', comuni[0]);
    }
  } catch (error) {
    console.error('❌ Errore:', error);
  }
})();
```

---

## Test 6: Sincronizza DBASE Manualmente

```javascript
console.log('=== TEST 6: Sincronizza DBASE ===');
(async () => {
  if (!excelSync.excelFile) {
    console.log('❌ Nessun file selezionato');
    return;
  }
  
  try {
    const arrayBuffer = await excelSync.excelFile.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    const result = await excelSync.syncDBase(workbook);
    
    console.log('Sync completato:', result ? '✅ SUCCESS' : '❌ FAILED');
    
    // Verifica cache
    const dj = JSON.parse(localStorage.getItem('BORDERO_DBASE_DATA'));
    console.log('DJ in cache:', dj?.length || 0);
    if (dj?.length > 0) {
      console.log('Primo DJ:', dj[0]);
    }
  } catch (error) {
    console.error('❌ Errore:', error);
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
console.log('✅ Brani:', brani.length);
console.log('✅ Comuni:', comuni.length);
console.log('✅ DJ:', dj.length);
console.log('Total cache:', keys.length, 'keys');
```

---

## Test 8: Test Admin Panel Functions

```javascript
console.log('=== TEST 8: Admin Panel ===');

// Verifica che AdminPanel sia caricato
if (typeof adminPanel === 'undefined') {
  console.log('⚠️ AdminPanel non ancora inizializzato');
} else {
  console.log('✅ AdminPanel caricato');
  console.log('Method log?', typeof adminPanel.log === 'function' ? '✅' : '❌');
  console.log('Method setupDataSync?', typeof adminPanel.setupDataSync === 'function' ? '✅' : '❌');
}
```

---

## 🚀 Quick Full Test (Copia Tutto)

```javascript
console.clear();
console.log('=== BORDERÒ EXCEL SYNC - FULL TEST ===\n');

// 1. Librerie
console.log('1️⃣ Librerie Caricate:');
console.log('  XLSX:', typeof XLSX === 'object' ? '✅' : '❌');
console.log('  excelSync:', typeof excelSync === 'object' ? '✅' : '❌');
console.log('  excelFileManager:', typeof excelFileManager === 'object' ? '✅' : '❌');

// 2. File
console.log('\n2️⃣ File Selezionato:');
console.log('  Caricato?', excelSync.excelFile ? '✅ ' + excelSync.excelFile.name : '❌ NESSUNO');

// 3. Cache
console.log('\n3️⃣ Cache:');
const brani = JSON.parse(localStorage.getItem('BORDERO_BRANI_DATA')) || [];
const comuni = JSON.parse(localStorage.getItem('BORDERO_COMUNI_DATA')) || [];
const dj = JSON.parse(localStorage.getItem('BORDERO_DBASE_DATA')) || [];
console.log('  Brani:', brani.length > 0 ? '✅ ' + brani.length : '❌ 0');
console.log('  Comuni:', comuni.length > 0 ? '✅ ' + comuni.length : '❌ 0');
console.log('  DJ:', dj.length > 0 ? '✅ ' + dj.length : '❌ 0');

// 4. Risultato
console.log('\n4️⃣ RISULTATO COMPLESSIVO:');
if (brani.length > 0 && comuni.length > 0 && dj.length > 0) {
  console.log('  ✅✅✅ TUTTO FUNZIONA PERFETTAMENTE! ✅✅✅');
} else {
  console.log('  ⚠️ Alcuni dati mancano - Tenta la sincronizzazione');
}
```

---

## 📋 Checklist Final

- [ ] Test 1: Tutte le librerie ✅
- [ ] Test 2: File selezionato ✅
- [ ] Test 3: File leggibile e fogli trovati ✅
- [ ] Test 4: Brani sincronizzati ✅
- [ ] Test 5: Comuni sincronizzati ✅
- [ ] Test 6: dBase sincronizzato ✅
- [ ] Test 7: Cache completo ✅
- [ ] Test 8: Admin Panel funzionante ✅

Se tutti ✅ → **SISTEMA PERFETTO!** 🎉

---

**Come usare questi test:**
1. Apri: http://localhost:8000/Bordero/pages/admin.html
2. Premi: **F12** (Dev Tools)
3. Vai al tab: **Console**
4. Copia uno dei test script sopra
5. Incolla in console
6. Premi: **ENTER**
7. Leggi i risultati

**Tempo totale:** ~5 minuti per il test completo
