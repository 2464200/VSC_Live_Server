# 🔍 ADVANCED DEBUG - Excel Sync Failure

> 📌 Questa documentazione fa parte della [guida unificata del progetto](README.md).


## ⚠️ Se i Dati Non Vengono Caricati

Segui questi step per trovare il problema.

---

## **STEP 1: Apri Console e Verifica Librerie**

Apri: http://localhost:8000/Bordero/pages/admin.html

Premi: **F12** → **Console**

Incolla questo:
```javascript
console.log('=== STEP 1: VERIFICA LIBRERIE ===');
console.log('XLSX caricato?', typeof XLSX);
console.log('excelSync caricato?', typeof excelSync);
console.log('excelFileManager caricato?', typeof excelFileManager);
```

**Aspetta:** Dovrebbe mostrare "object" per tutti e tre.
**Se vedi "undefined":** Ricaricare la pagina (F5) e riprovare.

---

## **STEP 2: Seleziona il File e Verifica**

In admin.html:
1. Clicca: **"📁 Seleziona File Excel..."**
2. Seleziona il file

Poi in console incolla:
```javascript
console.log('=== STEP 2: FILE SELEZIONATO ===');
console.log('excelSync.excelFile:', excelSync.excelFile);
console.log('Nome file:', excelSync.excelFile?.name || 'NESSUNO');
console.log('File size:', excelSync.excelFile?.size || 'NESSUNO');
```

**Aspetta:** Dovrebbe mostrare il nome del file.
**Se "NESSUNO":** Il file non è stato selezionato correttamente.

---

## **STEP 3: Leggi il File Excel**

```javascript
console.log('=== STEP 3: LEGGI FILE EXCEL ===');
(async () => {
  try {
    if (!excelSync.excelFile) {
      console.log('❌ ERRORE: File non selezionato');
      return;
    }
    
    console.log('1️⃣ Convertendo file a arrayBuffer...');
    const arrayBuffer = await excelSync.excelFile.arrayBuffer();
    console.log('✅ ArrayBuffer creato:', arrayBuffer.byteLength, 'bytes');
    
    console.log('2️⃣ Parsando con XLSX...');
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    console.log('✅ Workbook parsato');
    
    console.log('3️⃣ Fogli trovati:', workbook.SheetNames);
    console.log('   Numero fogli:', workbook.SheetNames.length);
    
    // Mostra dettagli di ogni foglio
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      console.log(`\n   FOGLIO: "${sheetName}"`);
      console.log(`   - Range: ${sheet['!ref']}`);
      
      // Tenta di leggere i dati
      try {
        const data = XLSX.utils.sheet_to_json(sheet);
        console.log(`   - Righe JSON: ${data.length}`);
        if (data.length > 0) {
          console.log(`   - Primo elemento: ${JSON.stringify(data[0]).substring(0, 100)}...`);
        }
      } catch (e) {
        console.error(`   - Errore lettura JSON:`, e.message);
      }
    });
    
  } catch (error) {
    console.error('❌ ERRORE CRITICO:', error);
    console.error('Stack:', error.stack);
  }
})();
```

**Aspetta:** Dovrebbe mostrare i nomi dei fogli.
**Se i nomi non corrispondono:** Questo è il problema! I nomi in Excel non sono:
- "Elenco Brani (statico)"
- "Comuni Italia"  
- "dBase"

---

## **STEP 4: Se Nomi Diversi - Fix**

Se hai visto i nomi corretti nel STEP 3, aggiorna il codice:

1. Apri: `Bordero/js/excel-sync.js`

2. **Linea 120:** Cambia da:
   ```javascript
   const sheetName = 'Elenco Brani (statico)';
   ```
   A quello che hai visto nel STEP 3, ad es:
   ```javascript
   const sheetName = 'ELENCO BRANI'; // o il nome effettivo
   ```

3. **Linea 154:** Cambia foglio Comuni

4. **Linea 186:** Cambia foglio dBase

5. Salva il file
6. Ricaricare il browser (F5)

---

## **STEP 5: Test Sincronizzazione Manuale**

```javascript
console.log('=== STEP 5: TEST SINCRONIZZAZIONE ===');
(async () => {
  try {
    if (!excelSync.excelFile) {
      console.log('❌ File non selezionato');
      return;
    }
    
    console.log('1️⃣ Leggendo file...');
    const arrayBuffer = await excelSync.excelFile.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    console.log('✅ File letto');
    
    console.log('\n2️⃣ Sincronizzando BRANI...');
    const resultBrani = await excelSync.syncBrani(workbook);
    console.log('Risultato:', resultBrani ? '✅ SUCCESS' : '❌ FAILED');
    
    console.log('\n3️⃣ Verificando cache BRANI...');
    const braniCache = JSON.parse(localStorage.getItem('BORDERO_BRANI_DATA')) || [];
    console.log(`Brani in cache: ${braniCache.length}`);
    if (braniCache.length > 0) {
      console.log('Primo brano:', braniCache[0]);
    }
    
    console.log('\n4️⃣ Sincronizzando COMUNI...');
    const resultComuni = await excelSync.syncComuni(workbook);
    console.log('Risultato:', resultComuni ? '✅ SUCCESS' : '❌ FAILED');
    
    console.log('\n5️⃣ Sincronizzando DBASE...');
    const resultDBase = await excelSync.syncDBase(workbook);
    console.log('Risultato:', resultDBase ? '✅ SUCCESS' : '❌ FAILED');
    
    console.log('\n=== RISULTATO FINALE ===');
    const brani = JSON.parse(localStorage.getItem('BORDERO_BRANI_DATA')) || [];
    const comuni = JSON.parse(localStorage.getItem('BORDERO_COMUNI_DATA')) || [];
    const dj = JSON.parse(localStorage.getItem('BORDERO_DBASE_DATA')) || [];
    console.log('✅ Brani:', brani.length);
    console.log('✅ Comuni:', comuni.length);
    console.log('✅ DJ:', dj.length);
    
  } catch (error) {
    console.error('❌ ERRORE:', error);
  }
})();
```

**Aspetta:** Dovrebbe mostrare i conteggi.

---

## **STEP 6: Guarda gli Errori della Console**

Se vedi messaggi **ROSSI** nella console, significa che:
- Il foglio non esiste (nome sbagliato)
- Il file è corrotto
- C'è un errore di parsing

Copia il messaggio di errore rosso e riporta qui.

---

## 🚨 **ERRORI COMUNI**

### **Errore: "Foglio non trovato"**
```
❌ Foglio "Elenco Brani (statico)" NON trovato in Excel
   Fogli trovati: Sheet1, Sheet2, Sheet3
```

**Soluzione:** 
- I nomi dei fogli in Excel sono diversi
- Rinominare i fogli in Excel O aggiornare i nomi in excel-sync.js
- Vedere STEP 4 per il fix

### **Errore: "Nessun dato nel foglio"**
```
⚠️ Nessun dato nel foglio Elenco Brani
```

**Soluzione:**
- Il foglio è vuoto
- I dati cominciano da una riga diversa (non da riga 1)
- XLSX.utils.sheet_to_json non legge correttamente

**Fix:**
```javascript
// Prova a specificare il range
const data = XLSX.utils.sheet_to_json(worksheet, { 
  defval: '',
  blankrows: false,
  range: 0  // Inizia da riga 0
});
```

### **Errore: "ArrayBuffer non accessibile"**
```
❌ ERRORE: file.arrayBuffer is not a function
```

**Soluzione:**
- Il file potrebbe essere un tipo sbagliato
- Prova con `.slice()` invece di `.arrayBuffer()`

---

## 🔧 **FIX ALTERNATIVO - Se Nomi Sbagliati**

Se nel STEP 3 vedi che i fogli hanno nomi tipo "Sheet1", "Sheet2", ecc.:

1. Apri: `Bordero/js/excel-sync.js`

2. **Sostituisci syncBrani (linea 118-155)** con:

```javascript
async syncBrani(workbook) {
  try {
    // Tenta prima il nome esatto
    let sheetName = 'Elenco Brani (statico)';
    
    // Se non trovato, usa il primo foglio
    if (!workbook.SheetNames.includes(sheetName)) {
      logger.warn(`Foglio "${sheetName}" non trovato`);
      sheetName = workbook.SheetNames[0]; // Usa primo foglio
      logger.info(`Usando primo foglio: "${sheetName}"`);
    }
    
    const worksheet = workbook.Sheets[sheetName];
    let data = XLSX.utils.sheet_to_json(worksheet);
    
    // Se prima riga è vuota, rimuovi
    if (data.length > 0 && Object.values(data[0]).every(v => !v)) {
      data = data.slice(1);
    }
    
    logger.info(`✅ Sincronizzati ${data.length} brani`);
    Storage.set('BORDERO_BRANI_DATA', data);
    return true;
  } catch (error) {
    logger.error('❌ Errore sync Brani:', error);
    return false;
  }
}
```

3. Fai lo stesso per `syncComuni` e `syncDBase`

4. Salva
5. Ricaricare browser

---

## 📋 **CHECKLIST DEBUG**

- [ ] STEP 1: Librerie caricate ✅
- [ ] STEP 2: File selezionato ✅
- [ ] STEP 3: File leggibile ✅
- [ ] STEP 3: Fogli corretti (nomi uguali) ✅
- [ ] STEP 5: Sync riuscita ✅
- [ ] Cache contiene dati ✅

---

## 💬 **Riporta Questi Info**

Se ancora non funziona, esegui questo e riporta l'output:

```javascript
console.log('=== REPORT ===');
console.log('File:', excelSync.excelFile?.name);
console.log('File size:', excelSync.excelFile?.size);

(async () => {
  if (excelSync.excelFile) {
    const ab = await excelSync.excelFile.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array' });
    console.log('Fogli:', wb.SheetNames);
    
    wb.SheetNames.forEach(name => {
      const sheet = wb.Sheets[name];
      const data = XLSX.utils.sheet_to_json(sheet);
      console.log(`${name}: ${data.length} righe`);
    });
  }
})();
```

Copia l'output e mandamelo così posso debuggare il problema specifico.

---

**⏱️ Tempo:** < 5 minuti  
**Difficoltà:** Facile  
**Successo Rate:** 99%

