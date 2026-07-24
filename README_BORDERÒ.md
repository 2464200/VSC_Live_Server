# ðŸŽ­ BORDERÃ’ - DJ Manager Web Application

> ðŸ“Œ Questa documentazione fa parte della [guida unificata del progetto](README.md).


**Status:** âœ… **PRODUCTION READY**  
**Version:** 1.0.0  
**Last Updated:** 2026-06-18  
**Created:** 2026-04-25

---

## ðŸ“‹ Overview

BORDERÃ’ Ã¨ una web application completa per la gestione di brani e coreografie per DJ. Convertita da Excel a HTML/CSS/JavaScript con sincronizzazione automatica da fogli Excel.

**FunzionalitÃ  Principali:**
- ðŸ“Š Tabella gestione brani con sort, filter, search
- âœ… Mark brani come eseguiti
- ðŸ“º Monitor secondario per DJ
- ðŸŽ¬ Display fullscreen prossimo brano
- ðŸ“ˆ Statistiche e report finale
- ðŸŽ¥ Video player per coreografie
- ðŸ”„ Sincronizzazione automatica da Excel
- ðŸ’¾ Auto-save su localStorage

---

## ðŸš€ Quick Start

### **Opzione 1: PowerShell Script (Consigliato)**

```powershell
cd C:\VSC_Live_Server
node unified-server.js
```

Questo:
- âœ… Avvia il runtime completo del progetto su porta 5500
- âœ… Espone Bordero ed Eventi con URL coerenti

### **Opzione 2: Manuale con Python**

```powershell
cd C:\VSC_Live_Server
python -m http.server 8000
```

Poi apri: `http://localhost:5500/Bordero/`

### **Opzione 3: VS Code Live Server**

1. Installa estensione "Live Server"
2. Click destro su `Bordero/index.html`
3. Seleziona "Open with Live Server"

---

## ðŸŒ URL Principali

| Pagina | URL | Descrizione |
|--------|-----|-------------|
| ðŸ  **Home** | `http://localhost:5500/index.html` | Portale principale |
| ðŸ“‹ **Bordero (PRINCIPALE)** | `http://localhost:5500/Bordero/pages/bordero.html` | Tabella gestione brani - USE THIS |
| ðŸŽ¬ **NextCoreo** | `http://localhost:5500/Bordero/pages/next-coreo.html` | Fullscreen prossima canzone |
| ðŸ“º **Monitor** | `http://localhost:5500/Bordero/pages/display.html` | Monitor secondario (live) |
| ðŸ“Š **Lista Serata** | `http://localhost:5500/Bordero/pages/lista-serata.html` | Report esecuzioni |
| ðŸ“ˆ **Risultati** | `http://localhost:5500/Bordero/pages/risultati.html` | Statistiche finali |
| ðŸŽ¥ **VideoClip** | `http://localhost:5500/Bordero/pages/videoclip.html` | Video manager |
| âš™ï¸ **Admin** | `http://localhost:5500/Bordero/pages/admin.html` | Testing & debug |

---

## ðŸ“ Struttura del Progetto

```
Bordero/
â”œâ”€â”€ index.html                          # Home page
â”œâ”€â”€ pages/
â”‚   â”œâ”€â”€ bordero.html                   # MAIN TABLE
â”‚   â”œâ”€â”€ bordero.js                     # Logic (14.2 KB)
â”‚   â”œâ”€â”€ bordero.css                    # Styles
â”‚   â”œâ”€â”€ next-coreo.html                # Fullscreen display
â”‚   â”œâ”€â”€ next-coreo.js                  # (6.7 KB)
â”‚   â”œâ”€â”€ next-coreo.css
â”‚   â”œâ”€â”€ display.html                   # Monitor secondario
â”‚   â”œâ”€â”€ display.js                     # (4.4 KB)
â”‚   â”œâ”€â”€ display.css
â”‚   â”œâ”€â”€ lista-serata.html              # Report
â”‚   â”œâ”€â”€ lista-serata.js                # (4.3 KB)
â”‚   â”œâ”€â”€ lista-serata.css
â”‚   â”œâ”€â”€ risultati.html                 # Statistics
â”‚   â”œâ”€â”€ risultati.js                   # (5.8 KB)
â”‚   â”œâ”€â”€ risultati.css
â”‚   â”œâ”€â”€ videoclip.html                 # Video manager
â”‚   â”œâ”€â”€ videoclip.js                   # (6.0 KB)
â”‚   â”œâ”€â”€ videoclip.css
â”‚   â”œâ”€â”€ admin.html                     # Admin panel
â”‚   â”œâ”€â”€ admin.js                       # (10.3 KB)
â”‚   â””â”€â”€ admin.css
â”œâ”€â”€ js/
â”‚   â”œâ”€â”€ config.js                      # Configuration
â”‚   â”œâ”€â”€ utils.js                       # Utilities
â”‚   â”œâ”€â”€ excel-sync.js                  # Excel syncing
â”‚   â””â”€â”€ data-loader.js                 # Data management
â”œâ”€â”€ assets/
â”‚   â””â”€â”€ css/
â”‚       â”œâ”€â”€ style.css                  # Base styles
â”‚       â”œâ”€â”€ bordero.css                # Overrides
â”‚       â””â”€â”€ responsive.css
â”œâ”€â”€ data/
â”‚   â”œâ”€â”€ brani.csv                      # Songs (from Excel)
â”‚   â”œâ”€â”€ dBase.csv                      # DJ list (from Excel)
â”‚   â””â”€â”€ comuni_italia.csv              # Locations (from Excel)
â””â”€â”€ Excel/
    â””â”€â”€ BorderÃ² - ver 13.1.69_con AutoHotkey da sistemare.xlsm
```

---

## ðŸ”„ Excel Synchronization

### **Automatic Sync al Caricamento**

All'avvio di `bordero.html`, il sistema:

1. **Carica il file Excel** da: `./Excel/BorderÃ² - ver 13.1.69_con AutoHotkey da sistemare.xlsm`
2. **Legge i tre fogli:**
   - ðŸ“„ **"Elenco Brani (statico)"** â†’ `brani.csv`
   - ðŸ“„ **"Comuni Italia"** â†’ `comuni_italia.csv`
   - ðŸ“„ **"dBase"** â†’ `dBase.csv`
3. **Sincronizza in cache** (localStorage)
4. **Mostra i dati** nel browser

### **Libreria XLSX**

Usa [XLSX.js](https://github.com/SheetJS/sheetjs) per leggere file Excel direttamente nel browser.

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.min.js"></script>
```

### **Admin Panel per Manual Sync**

Vai a: `http://localhost:5500/Bordero/pages/admin.html`

- ðŸ”„ Sincronizza singoli fogli
- ðŸ’¾ Export/Import dati
- ðŸ—‘ï¸ Clear cache
- ðŸ–¥ï¸ Test console

---

## ðŸ’¾ Data Persistence

### **localStorage Keys**

```javascript
BORDERO_BRANI_DATA              // Brani array from Excel
BORDERO_COMUNI_DATA             // Comuni array from Excel
BORDERO_DBASE_DATA              // DJ array from Excel
BORDERO_CURRENT_SERATA          // Current working session
BORDERO_SERATA_HISTORY          // Archive of past sessions
BORDERO_LAST_EXCEL_SYNC         // Last sync timestamp
```

### **Fresh vs Persistent**

- **New Serata:** Fresh data load, empty table
- **During Serata:** Auto-save to localStorage on every mark
- **End Serata:** Archive to history, clear current
- **Recovery:** Load last serata from history if browser restarted

---

## ðŸŽ¯ Workflow Tipico

```
1. Apri http://localhost:5500/Bordero/pages/bordero.html
   â†“
2. Seleziona DJ da dropdown
   â†“
3. Seleziona Location da dropdown
   â†“
4. Ricerca brani con search box
   â†“
5. Click su brano per marcare come "Eseguito"
   â†’ La riga grays, X appare, timestamp aggiunto
   â†’ Brano scivola in fondo
   â†“
6. Apri http://localhost:5500/Bordero/pages/next-coreo.html su MONITOR SECONDARIO
   â†’ Mostra prossimo brano in fullscreen
   â†“
7. Apri http://localhost:5500/Bordero/pages/display.html su MONITOR ESTERNO
   â†’ Live table per DJ con aggiornamenti ogni 1 secondo
   â†“
8. Quando finito: Click "FINISCI SERATA"
   â†’ Vai a lista-serata.html per report dettagliato
   â†“
9. Vedi statistiche su http://localhost:5500/Bordero/pages/risultati.html
   â†’ Generi suonati, difficoltÃ , top coreografi, %completamento
```

---

## ðŸ§ª Testing

### **Admin Panel (Recommended)**

1. Apri: `http://localhost:5500/Bordero/pages/admin.html`
2. Verifica:
   - âœ… System status
   - âœ… Data sync status
   - âœ… Cache contents
   - âœ… Export/Import

### **Browser DevTools**

- **F12** â†’ Console â†’ Vedi logs
- **F12** â†’ Application â†’ localStorage â†’ Vedi cache keys
- **F12** â†’ Network â†’ Verifica caricamento Excel

## Git (main/develop)

Prima di lavorare su documentazione o codice:

```powershell
git fetch --all --prune
git checkout develop
git pull origin develop
```

Guida completa: `GUIDA_GIT_MAIN_DEVELOP.md`.

### **Manual Test Checklist**

- [ ] Bordero: Tabella carica 20+ brani
- [ ] Bordero: DJ dropdown ha 3 opzioni
- [ ] Bordero: Location dropdown ha 7 opzioni
- [ ] Bordero: Mark brano â†’ X appare, timestamp added
- [ ] Bordero: Row scivola in fondo
- [ ] Bordero: Sort per ID, GENERE, AUTORE funziona
- [ ] Bordero: Filter funziona
- [ ] Bordero: Export SIAE scarica CSV
- [ ] Bordero: Export SIAE salva il file in `C:\VSC_SIAE\`
- [ ] Bordero: Nome file `GG-MM-AAAA-HHMMSS_SIAE_VSC.csv`
- [ ] Bordero: Header esatto `Titolo,Autore,Compositore,Performer,Durata`
- [ ] NextCoreo: Mostra prossimo brano in fullscreen
- [ ] NextCoreo: Updates in tempo reale quando mark in bordero
- [ ] Display: Table carica da localStorage
- [ ] Display: Auto-refresh ogni 1 secondo
- [ ] Lista-Serata: Split eseguiti vs pendenti
- [ ] Risultati: Stats % corretti
- [ ] VideoClip: 20+ video cards, search funziona

---

## ðŸ”§ Configuration

### **Config File: `js/config.js`**

```javascript
BORDERO_CONFIG = {
  CSV_BRANI: './data/brani.csv',
  CSV_COMUNI: './data/comuni_italia.csv',
  CSV_DBASE: './data/dBase.csv',
  CACHE_KEY_BRANI: 'BORDERO_BRANI_DATA',
  CACHE_KEY_CURRENT_SERATA: 'BORDERO_CURRENT_SERATA',
  ITEMS_PER_PAGE: 50,
  ...
};
```

Modifica questo file per:
- Cambiare percorsi CSV
- Aggiungere colonne CSV
- Modificare cache keys
- Cambiare limiti pagina

---

## ðŸ› Troubleshooting

### **Tabella Vuota**
**Causa:** CSV non caricato  
**Soluzione:**
- Controlla F12 â†’ Console per errori
- Verifica che `./data/brani.csv` esista
- Prova sync manuale da admin panel

### **Dropdown Vuoti**
**Causa:** DJ o Comuni non caricati  
**Soluzione:**
- Verifica `dBase.csv` e `comuni_italia.csv` hanno dati
- Prova sync da admin panel
- Controlla XLSX.js caricata correttamente

### **Excel Non Sincronizza**
**Causa:** File Excel non trovato o non accessibile  
**Soluzione:**
- Verifica file esiste in `./Excel/`
- Controlla nome file esatto: `BorderÃ² - ver 13.1.69_con AutoHotkey da sistemare.xlsm`
- Se offline: fallback a CSV locale (OK)

### **Port 8000 GiÃ  in Uso**
**Causa:** Altro processo usa porta 8000  
**Soluzione:**
```powershell
# Usa porta diversa
python -m http.server 8001
# Accedi a: http://localhost:8001/Bordero/
```

### **CORS/Security Errors**
**Causa:** Browser blocco restrizioni  
**Soluzione:**
- Assicurati di usare `http://localhost` (non `file://`)
- Server deve essere avviato
- Se XLSX CDN non disponibile, scarica localmente

---

## ðŸ“Š Features

| Feature | Status | Note |
|---------|--------|------|
| CSV Data Loading | âœ… | Cached in localStorage |
| Excel Sync | âœ… | Automatic on page load |
| Sort | âœ… | ID, GENERE, AUTORE |
| Filter | âœ… | Per colonna |
| Search | âœ… | Full-text search |
| Mark Complete | âœ… | X flag + timestamp |
| Auto-save | âœ… | Every mark |
| Export SIAE | âœ… | Backend + file in `C:\VSC_SIAE\` |
| Serata Archive | âœ… | History with timestamp |
| Fullscreen Display | âœ… | NextCoreo + videoclip |
| Monitor Sync | âœ… | 1sec refresh |
| Report Generation | âœ… | Lista-serata + risultati |
| Statistics | âœ… | Generi, difficoltÃ , coreografi |
| Admin Panel | âœ… | Debug, sync, export/import |
| Responsive Design | âœ… | Mobile/tablet friendly |

---

## ðŸ“ File Statistics

**Total Codebase: ~110 KB**

- JavaScript: ~48 KB (7 files)
- CSS: ~41 KB (7 files)
- HTML: ~18 KB (8 pages)
- Data: ~3 KB (3 CSV files)

**Lines of Code:** ~2500 LOC

---

## ðŸ¤ Integration Points

### **Excel File Location**
```
Excel/BorderÃ² - ver 13.1.69_con AutoHotkey da sistemare.xlsm
```

### **Sheet Names (Exact Match)**
- `Elenco Brani (statico)`
- `Comuni Italia`
- `dBase`

### **Column Headers (Must Match)**
- Brani: ID, Titolo, Autore, Coreografo, Genere, Info_Livello, Compositore, Performer, Durata
- Comuni: ID, Nome
- dBase: ID, Nome, Ruolo, Status

---

## ðŸ” Security Notes

- **No Backend Required:** Client-side only
- **No External API:** Except XLSX CDN (optional)
- **localStorage:** Data stays in browser
- **CORS:** Not an issue (same origin)
- **No Credentials:** No auth required

---

## ðŸ“¦ Deployment

### **Firebase Hosting**

```powershell
firebase login
firebase deploy --only hosting
```

Copy `Bordero/` folder to Firebase `public/` folder.

### **Self-Hosted**

Upload `Bordero/` folder to any web server:
- Apache
- Nginx
- IIS
- Node.js Express
- Python http.server

---

## ðŸ“ž Support

### **Debug Console**

Apri F12 â†’ Console, digita:
```javascript
// View all localStorage
Object.keys(localStorage)

// Clear cache
for (let key in localStorage) {
  if (key.startsWith('BORDERO_')) localStorage.removeItem(key);
}

// Check brani
JSON.stringify(Storage.get('BORDERO_BRANI_DATA'), null, 2)

// Sync manually
excelSync.syncFromExcel()
```

### **Admin Panel**

`http://localhost:5500/Bordero/pages/admin.html`
- Full system diagnostics
- Manual sync
- Export/import data
- Clear cache
- Test console

---

## ðŸŽ‰ Conclusion

BORDERÃ’ Ã¨ una web application completa, fully functional, pronta per la produzione.

**Caratteristiche:**
- âœ… Sincronizzazione automatica da Excel
- âœ… Interfaccia intuitiva e responsive
- âœ… Data persistence con localStorage
- âœ… Real-time multi-screen sync
- âœ… Comprehensive reporting
- âœ… Admin panel per debugging

**Pronto a:**
- ðŸš€ Avviarsi subito
- ðŸ§ª Essere testato
- ðŸ“¦ Essere deployato
- ðŸ”„ Essere esteso

---

**Version:** 1.0.0  
**Status:** âœ… Production Ready  
**Date:** 2026-06-18



