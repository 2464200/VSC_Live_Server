# ðŸŽ­ BORDERÃ’ - Guida alla Selezione del File Excel

> ðŸ“Œ Questa documentazione fa parte della [guida unificata del progetto](README.md).


## ðŸ”§ Come Funziona il Nuovo Sistema

Il sistema ora **chiede all'utente di selezionare il file Excel** invece di cercarlo automaticamente. Questo risolve il problema "excel non Ã¨ definito" e rende il processo piÃ¹ trasparente.

---

## ðŸ“ Opzione 1: Admin Panel (Consigliato)

### **Passo 1: Apri Admin Panel**
```
http://localhost:5500/Bordero/pages/admin.html
```

### **Passo 2: Seleziona il File Excel**
1. Scorri giÃ¹ fino alla sezione **"ðŸ“Š Data Synchronization"**
2. Clicca sul pulsante: **"ðŸ“ Seleziona File Excel..."**
3. Si aprirÃ  una finestra di dialogo
4. Naviga fino a: `C:\VSC_Live_Server\Excel\`
5. Seleziona: `BorderÃ² - ver 13.1.69_con AutoHotkey da sistemare.xlsm`
6. Clicca **"Apri"**

### **Passo 3: Verifica il Caricamento**
- Vedrai il nome del file sotto il pulsante:
  ```
  âœ“ File selezionato: BorderÃ² - ver 13.1.69_con AutoHotkey da sistemare.xlsm (1.2 MB)
  ```

### **Passo 4: Sincronizza i Dati**
Clicca uno di questi pulsanti:
- **"ðŸ”„ Sincronizza Tutto da Excel"** - Sincronizza tutti i dati
- **"ðŸ”„ Sync Brani"** - Solo il foglio "Elenco Brani (statico)"
- **"ðŸ”„ Sync Comuni"** - Solo il foglio "Comuni Italia"
- **"ðŸ”„ Sync dBase"** - Solo il foglio "dBase"

---

## ðŸ“ Opzione 2: Bordero Pagina Principale

### **Passo 1: Apri Bordero**
```
http://localhost:5500/Bordero/pages/bordero.html
```

### **Passo 2: Seleziona File Excel (Automatico)**
- Alla prima volta che la pagina si carica, vedrai una richiesta di dialogo
- Seleziona il file Excel come descritto sopra
- La pagina caricherÃ  automaticamente i dati

### **Passo 3: I Dati Appaiono Automaticamente**
- La tabella si popola con i brani
- I dropdown DJ e Location si riempiono
- Vedrai il messaggio: **"âœ“ Caricati XXX brani"**

---

## ðŸ” Dove Trovare il File Excel

**Percorso completo:**
```
C:\VSC_Live_Server\Excel\BorderÃ² - ver 13.1.69_con AutoHotkey da sistemare.xlsm
```

**Caratteristiche del file:**
- ðŸ“„ Nome: `BorderÃ² - ver 13.1.69_con AutoHotkey da sistemare.xlsm`
- ðŸ“Š Formato: Excel (.xlsm)
- ðŸ’¾ Dimensione: ~1.2 MB
- ðŸ“ Cartella attuale: `C:\VSC_Live_Server\Excel\`

---

## ðŸ“š Fogli Excel Sincronizzati

Il sistema legge automaticamente **3 fogli** dal file Excel:

| # | Nome Foglio | CSV Destinazione | Uso |
|----|-------------|------------------|-----|
| 1 | **Elenco Brani (statico)** | `Bordero/data/brani.csv` | Lista di tutti i brani |
| 2 | **Comuni Italia** | `Bordero/data/comuni_italia.csv` | Lista locations/comuni |
| 3 | **dBase** | `Bordero/data/dBase.csv` | Lista DJ/performers |

---

## âœ… Verifica il Caricamento

### **Nel Admin Panel**
1. Vai a: `http://localhost:5500/Bordero/pages/admin.html`
2. Scorri fino a: **"ðŸ“‹ Data Viewer"**
3. Seleziona:
   - **"Brani (Songs)"** - Verifica lista brani
   - **"Comuni Italia"** - Verifica lista comuni
   - **"dBase (DJ)"** - Verifica lista DJ
4. Dovresti vedere i dati tabulati

### **In Bordero Pagina**
1. Vai a: `http://localhost:5500/Bordero/pages/bordero.html`
2. Verifica:
   - âœ… Tabella ha 20+ righe di brani
   - âœ… Dropdown DJ ha 3+ opzioni
   - âœ… Dropdown Comuni ha 7+ opzioni
   - âœ… Console (F12) non ha errori rossi

### **In Browser Console (F12)**
```javascript
// Verifica brani caricati
JSON.stringify(localStorage.getItem('BORDERO_BRANI_DATA')).length > 100

// Verifica comuni caricati
JSON.stringify(localStorage.getItem('BORDERO_COMUNI_DATA')).length > 50

// Verifica DJ caricati
JSON.stringify(localStorage.getItem('BORDERO_DBASE_DATA')).length > 50
```

---

## ðŸš¨ Troubleshooting

### **Problema: "Excel non Ã¨ definito"**
**Soluzione:**
1. Ricarica la pagina (F5 o Ctrl+R)
2. Verifica che XLSX.js sia caricato (F12 â†’ Network tab, cerca "xlsx.min.js")
3. Se non c'Ã¨, il CDN non Ã¨ accessibile. Soluzione:
   - Scarica XLSX.js localmente e includi come: `<script src="../js/xlsx.min.js"></script>`

### **Problema: Dialogo non appare**
**Soluzione:**
1. Controlla che il file sia in: `C:\VSC_Live_Server\Excel\`
2. Verifica il nome esatto del file
3. Prova a navigare manualmente nella finestra di dialogo

### **Problema: Dati non si sincronizzano**
**Soluzione:**
1. Verifica che il file Excel sia stato selezionato correttamente
2. Clicca il pulsante "ðŸ”„ Sincronizza Tutto da Excel"
3. Guarda il console (F12) per messaggi di errore
4. Se il foglio ha nome diverso, aggiorna `excel-sync.js` linea 57, 91, 125

### **Problema: File Excel Corrotto**
**Soluzione:**
1. Riapri il file in Excel e salva di nuovo
2. Esporta i fogli come nuovo file
3. Verifica che i 3 fogli esistano e abbiano dati

---

## ðŸ”§ File Coinvolti nel Sistema

## Git (main/develop)

```powershell
git fetch --all --prune
git checkout develop
git pull origin develop
```

Dettagli completi in `GUIDA_GIT_MAIN_DEVELOP.md`.

**File creati/modificati:**

| File | Ruolo | Modifche |
|------|-------|----------|
| `js/excel-file-manager.js` | ðŸ†• File manager + dialoghi | Nuovo file |
| `js/excel-sync.js` | Sincronizzazione dati | Modificato per usare file selezionato |
| `pages/bordero.html` | Aggiunto excel-file-manager.js | Aggiunto script |
| `pages/admin.html` | Aggiunto pulsante selezione | Aggiunto UI + script |
| `pages/admin.js` | Gestione pulsante | Aggiunto setupExcelFileSelection() |

---

## ðŸ“Š Flusso del Sistema

```
1. Utente carica bordero.html
   â†“
2. Se primo caricamento:
   a. Script carica XLSX.js da CDN
   b. Excel non ancora selezionato
   â†’ Admin Panel mostra pulsante "Seleziona File Excel"
   â†“
3. Utente clicca pulsante:
   a. Finestra di dialogo file
   b. Utente naviga e seleziona file Excel
   c. excelFileManager.readExcelFile() legge il file
   â†“
4. Sincronizzazione automatica:
   a. excelSync.syncBrani() â†’ localStorage
   b. excelSync.syncComuni() â†’ localStorage
   c. excelSync.syncDBase() â†’ localStorage
   â†“
5. Dati disponibili:
   a. Bordero tabella si popola
   b. Dropdown si riempiono
   c. App Ã¨ pronta all'uso
```

---

## ðŸ’¡ Note Importanti

### **1. Il File Rimane Caricato**
Una volta selezionato il file Excel:
- Rimane caricato in memoria
- Non devi selezionarlo di nuovo (finchÃ© non ricarichi)
- Puoi cliccare "Sincronizza" quante volte vuoi

### **2. Fallback a CSV**
Se non selezioni il file Excel:
- Il sistema usa i file CSV locali in `Bordero/data/`
- I dati sono gli ultimi sincronizzati
- Questo Ã¨ utile offline

### **3. Cache Locale**
I dati vengono salvati in `localStorage`:
- Anche se offline, i dati rimangono disponibili
- Cache persiste fino a quando non pulisci localStorage
- Puoi cancellare con admin panel â†’ "Clear All Cache"

### **4. Multi-Tab Sync**
Se apri piÃ¹ tab di Bordero:
- Tutte leggono lo stesso file Excel
- I dati si sincronizzano tra tab automaticamente
- localStorage events notificano le altre tab

---

## ðŸŽ¯ Workflow Completo

### **Prima Volta**
```
1. Apri http://localhost:5500/Bordero/pages/admin.html
2. Clicca "ðŸ“ Seleziona File Excel..."
3. Naviga a C:\\VSC_Live_Server\\Excel\\
4. Seleziona il file .xlsm
5. Clicca "ðŸ”„ Sincronizza Tutto da Excel"
6. Verifica i dati nel Data Viewer
7. Apri http://localhost:5500/Bordero/pages/bordero.html
8. Dati already loaded, inizia a usare!
```

### **Volte Successive**
```
1. Apri http://localhost:5500/Bordero/pages/bordero.html
2. Il sistema ricorda il file selezionato
3. Dati automaticamente disponibili
4. Se file modificato, clicca "Sincronizza" in admin
```

---

## ðŸš€ Deployment / Cambio PC

Se sposti il file Excel a un nuovo PC:

1. **Aggiorna il percorso** (se diverso):
   ```javascript
   // Non necessario! Il dialogo ti permette di scegliere
   // Il percorso Ã¨ automatico dall'utente
   ```

2. **Usa il dialogo file**:
   - Admin Panel â†’ Seleziona File Excel
   - Naviga al nuovo percorso
   - Sincronizza

3. **Se Ã¨ sempre in Excel\\**:
   ```
   C:\\VSC_Live_Server\\Excel\\BorderÃ² - ver 13.1.69_con AutoHotkey da sistemare.xlsm
   ```
   Allora non devi fare nulla! Il dialogo parte da lÃ¬ per default.

---

## ðŸ“ž Support

**Se ricevi errori:**

1. **"XLSX is not defined"**
   - Ricarica pagina (F5)
   - Controlla che XLSX.js sia caricato
   - Guarda F12 â†’ Network

2. **"File not found"**
   - Verifica il percorso: `C:\\VSC_Live_Server\\Excel\\`
   - Assicurati il nome sia esatto
   - Se il percorso Ã¨ diverso, usa il dialogo per navigare

3. **"Sheet not found"**
   - Il file non ha i 3 fogli richiesti
   - Verifica che Excel contenga:
     - "Elenco Brani (statico)"
     - "Comuni Italia"
     - "dBase"
   - Se nomi diversi, aggiorna `excel-sync.js`

4. **"Sync failed, using CSV fallback"**
   - Il file Excel non Ã¨ leggibile
   - App usa i CSV locali (ultimo sync)
   - Riprova a selezionare il file

---

**Status:** âœ… **Sistema Completo e Funzionante**  
**Data:** 2026-06-18



