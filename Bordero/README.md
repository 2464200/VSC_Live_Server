# 🎭 BORDERÒ - DJ Manager

> 📌 Questa documentazione fa parte della [guida unificata del progetto](../README.md).

## Sistema di Gestione Brani e Coreografie

Versione: **1.0.0**  
Stato: **In sviluppo** 🚧

---

## 📖 Indice
1. [Panoramica](#panoramica)
2. [Funzionalità Principali](#funzionalità-principali)
3. [Installazione](#installazione)
4. [Struttura Progetto](#struttura-progetto)
5. [Configurazione](#configurazione)
6. [Utilizzo](#utilizzo)
7. [API & Funzioni](#api--funzioni)
8. [Sviluppo](#sviluppo)
9. [Troubleshooting](#troubleshooting)

---

## 📋 Panoramica

**BORDERÒ** è un'applicazione web HTML/CSS/JavaScript che replica le funzionalità del file Excel originale, convertito in una soluzione moderna e responsive.

L'applicazione consente ai DJ di:
- ✅ Gestire un database di brani e coreografie
- 🔍 Ricercare e filtrare brani in tempo reale
- 📊 Visualizzare statistiche e report
- 🎬 Riprodurre video coreografia
- 🖥️ Proiettare liste su monitor esterno
- 💾 Sincronizzare dati da Google Sheets
- ⚡ Accedere ai dati anche offline con cache locale

---

## ✨ Funzionalità Principali

### 1. **Tabella Brani** (bordero.html)
- Visualizzazione elenco completo brani
- Colonne: ID, Titolo, Autore, Genere, Livello, Categoria, Coreografo, Collaboratori
- Filtri per ogni colonna
- Ricerca full-text
- Ordinamento multi-colonna
- Flag per marcare brani eseguiti

### 2. **Ricerca & Filtri**
- **Filtri per colonna:** dropdown sul header
- **Quick filters:** pulsanti rapidi (Coreografia, Genere, Altro, Livello)
- **Full-text search:** ricerca across multiple fields
- **Reset filtri:** pulsante per ripristinare vista completa

### 3. **Ordinamento**
- Sort per ID, Titolo, Autore, Genere, Livello, Coreografo
- Ascending/Descending toggle
- Visual indicator di sort attivo

### 4. **UserForm** (Modal)
- Aggiunta nuovi brani
- Modifica brani esistenti
- Eliminazione brani
- Validazione dati

### 5. **Video Player** (videoclip.html)
- Riproduzione video coreografia
- Controls: Play/Pause/Stop
- Fullscreen
- Progress bar

### 6. **Monitor Secondario** (display.html)
- Proiezione lista su monitor esterno
- Layout ottimizzato per grande schermo
- Auto-refresh sincronizzato con pagina principale
- Font size grande per leggibilità

### 7. **NextCoreo** (next-coreo.html)
- Visualizza prossimo brano da eseguire
- Update automatico quando brano marcato come completato
- Display grande e ben visibile

### 8. **Lista per Serata** (lista-serata.html)
- Report completo brani eseguiti
- Timestamp esecuzione
- Export PDF/Excel

### 9. **Statistiche** (risultati.html)
- Numero brani eseguiti
- Statistiche per coreografo
- Grafici e charts

### 10. **Sincronizzazione Dati**
- Caricamento da Google Sheets (con API key)
- Cache locale in localStorage
- Offline mode con dati cached
- Auto-sync ogni 5 minuti

---

## 🛠️ Installazione

### Requisiti
- Browser moderno (Chrome, Firefox, Safari, Edge)
- Connessione internet (per sincronizzazione iniziale)

### Steps
1. Clona o copia il progetto nella cartella `/Bordero`
2. Apri `index.html` in un browser
3. I dati vengono caricati automaticamente da `data/brani.csv`

### Per sviluppo locale
```bash
# Usa un server HTTP locale (non file://)
python -m http.server 8000
# oppure
npx http-server -c-1
```

Poi visita: `http://localhost:8000/Bordero/`

---

## 📁 Struttura Progetto

```
Bordero/
├── index.html                     # Home page principale
├── pages/
│   ├── bordero.html              # Tabella principale (FOGLIO CORE)
│   ├── display.html              # Monitor esterno
│   ├── next-coreo.html           # Prossimo brano
│   ├── videoclip.html            # Video player
│   ├── lista-serata.html         # Report serata
│   ├── risultati.html            # Statistiche
│   ├── ibbase.html               # Database base (lookup)
│   ├── comuni-italia.html        # Comuni (lookup)
│   ├── modulo8.html              # Modulo 8
│   ├── modulo12.html             # Modulo 12
│   ├── accoda.html               # Accodamento logica
│   ├── publisher-show.html       # Integrazione publisher
│   └── admin.html                # Admin panel
├── assets/
│   ├── css/
│   │   ├── bordero.css           # Style principale
│   │   ├── responsive.css        # Media queries
│   │   ├── animations.css        # Animazioni
│   │   └── style.css             # (da copiare da Eventi)
│   ├── img/                      # Immagini/Icone
│   └── fonts/                    # Font custom (opzionale)
├── js/
│   ├── config.js                 # Configurazione globale
│   ├── utils.js                  # Utility functions
│   ├── data-loader.js            # Caricamento dati e sync
│   ├── table-manager.js          # Logica tabella principale
│   ├── filters.js                # Filtri e ricerca
│   ├── sorting.js                # Ordinamento
│   ├── userform.js               # UserForm logic
│   ├── video-player.js           # Video controls
│   ├── export.js                 # Export/Print
│   ├── navigation.js             # Navigation tra pagine
│   └── index.js                  # Index page logic
├── data/
│   ├── brani.csv                 # Dati principali (sync da Google Sheets)
│   ├── comuni.csv                # Dati comuni Italia
│   ├── modules.csv               # Dati moduli
│   └── cache.json                # Cache locale (auto-generated)
├── README.md                     # Questo file
├── INSTALLATION.md               # Guida installazione
└── archive/                      # File vecchi/backup
```

---

## ⚙️ Configurazione

### ConfigJS (js/config.js)

Modifica le costanti in `js/config.js`:

```javascript
const BORDERO_CONFIG = {
  // CSV da caricare
  CSV_BRANI: './data/brani.csv',
  
  // Google Sheets API (opzionale)
  GOOGLE_SHEETS_API_KEY: 'YOUR_API_KEY_HERE',
  GOOGLE_SHEETS_ID: 'YOUR_SHEET_ID_HERE',
  
  // Timing
  SYNC_INTERVAL_MS: 5 * 60 * 1000,  // 5 minuti
  
  // Tabella
  ITEMS_PER_PAGE: 50,
  HEADER_STICKY: true,
  
  // Colori
  COLORS: { /* ... */ },
  
  // Debug
  DEBUG_MODE: true,
};
```

> Nota: il sync server-side usa anche `Bordero/config/.env` per la variabile `GOOGLE_API_KEY`.
> Se il file `.env` non esiste, `Bordero/server/google-sheets-sync.js` proverà comunque il fallback pubblico via export/`gviz/tq`.


### CSV Format (data/brani.csv)

```csv
ID,Titolo,Autore,Genere,Info_Livello,Info_Coreo,Coreografo,Collaboratori,VideoURL
001,Lost in the shuffle,Michael Peterson,COUNTRY,BASE,COREOGRAFIA,Peter Metzincik,02 coreografie 4 minuti,
...
```

**Colonne obbligatorie:** ID, Titolo, Autore  
**Colonne opzionali:** VideoURL, Note, etc.

---

## 🚀 Utilizzo

### Home Page (index.html)
- Mostra statistiche rapide
- Pulsanti di navigazione
- Azioni rapide (Sincronizza, Pulisci cache, Export)

### Bordero (pages/bordero.html) - PAGINA PRINCIPALE
```javascript
// Carica dati
await dataLoader.loadBrani();

// Ottieni brani filtrati
const brani = dataLoader.getBrani(filters, searchTerm);

// Ordina
const sorted = dataLoader.sortBrani(brani, 'titolo', 'asc');

// Marca come completato
dataLoader.markAsCompleted(branoId);

// Export CSV
dataLoader.exportToCSV();
```

### Display (pages/display.html)
Apri automaticamente su monitor secondario:
```javascript
window.open('pages/display.html', 'display', 
  'width=1920,height=1080');
```

### NextCoreo (pages/next-coreo.html)
```javascript
function getNextCoreo() {
  return dataLoader.brani.find(b => b.flag !== 'X');
}
```

---

## 📚 API & Funzioni

### DataLoader API

```javascript
// Caricamento
await dataLoader.loadBrani()           // Carica da CSV
await dataLoader.syncFromGoogle(...)   // Sync da Google Sheets

// Ricerca
dataLoader.getBrani(filters, search)   // Con filtri
dataLoader.getBranoById(id)            // Singolo brano

// Modifica
dataLoader.saveBrano(brano)            // Salva/modifica
dataLoader.deleteBrano(id)             // Elimina

// Flag
dataLoader.markAsCompleted(id)         // Marca X
dataLoader.unmarkCompleted(id)         // Deseleziona

// Utilità
dataLoader.getStats()                  // Statistiche
dataLoader.exportToCSV()               // Export
dataLoader.clearCache()                // Pulisci cache
dataLoader.getLastSyncFormatted()      // Ultimo sync
```

### Storage API

```javascript
Storage.set(key, value)                // Salva localStorage
Storage.get(key, defaultValue)         // Leggi localStorage
Storage.remove(key)                    // Rimuovi
Storage.clear()                        // Pulisci tutto
```

### Toast Notifications

```javascript
Toast.success('Messaggio successo')
Toast.error('Messaggio errore')
Toast.warning('Avviso')
Toast.info('Informazione')
```

---

## 🔧 Sviluppo

### Aggiungere una Nuova Pagina
1. Crea file HTML in `pages/`
2. Importa CSS e JS globali
3. Crea JS specifico in `js/`
4. Aggiungi link nella navigazione

### Aggiungere una Colonna Tabella
1. Modifica CSV aggiungendo colonna
2. Aggiorna `BORDERO_CONFIG.TABLE_COLUMNS`
3. Aggiorna HTML tabella

### Aggiungere un Filtro
1. Modifica `filters.js`
2. Aggiorna `filterTable()` function
3. Aggiorna UI con dropdown

### Debug Mode
Abilita debug in config.js:
```javascript
BORDERO_CONFIG.DEBUG_MODE = true;
BORDERO_CONFIG.LOG_LEVEL = 'DEBUG';
```

Vedi console per log dettagliati.

---

## 🐛 Troubleshooting

### "CSV not found" error
- Verifica percorso in `config.js`
- Usa server HTTP, non file://
- Check browser console (F12)

### Dati non sincronizzano
- Verifica Google Sheets API key
- Controlla connessione internet
- Controlla che `Bordero/config/.env` contenga `GOOGLE_API_KEY`
- Se non usi API key, lo script può comunque usare il fallback pubblico via `export?format=tsv` o `gviz/tq`
- Vedi console per errore specifico

### Log aggiuntivo
- `Bordero/server/google-sheets-sync.js` ora stampa anche i file generati alla fine dello script
- Questo è utile per verificare rapidamente quali CSV sono stati creati

### Offline mode non funziona
- localStorage deve essere abilitato
- Verifica che cache sia stata salvata
- Reset cache e ricarica pagina

### Performance lenta
- Riduci items per pagina in config
- Abilita pagination
- Usa CSV più piccolo per test

### CSS non applica
- Verifica percorsi file CSS
- Ctrl+Shift+R hard refresh
- Check browser DevTools (F12)

---

## 📞 Supporto

### Domande Frequenti

**D: Posso usare questo offline?**  
A: Sì! I dati vengono cached in localStorage. Funziona anche senza internet dopo primo caricamento.

**D: Come collego il mio Google Sheets?**  
A: Aggiungi API key e Sheet ID in config.js, poi chiama `dataLoader.syncFromGoogle()`

**D: Posso aggiungere colonne?**  
A: Sì, aggiungi al CSV e aggiorna TABLE_COLUMNS in config.js

**D: Come stampo la tabella?**  
A: Usa Ctrl+P nel browser, oppure `dataLoader.exportToCSV()`

---

## 📝 Changelog

### v1.0.0 (2026-06-18)
- ✅ Setup struttura base
- ✅ Config e utilità
- ✅ Data loader e sync
- ⏳ Tabella principale (in progress)
- ⏳ Filtri e ricerca (in progress)
- ⏳ Video player (in progress)
- ⏳ Display monitor (in progress)

---

## 🎯 Roadmap

- [ ] Tabella principale con dati
- [ ] Filtri per colonna
- [ ] Full-text search
- [ ] Ordinamento multi-colonna
- [ ] UserForm modal
- [ ] Video player
- [ ] Monitor secondario
- [ ] NextCoreo display
- [ ] Report statistiche
- [ ] Google Sheets sync
- [ ] Offline mode completo
- [ ] Print/Export
- [ ] Admin panel
- [ ] User authentication
- [ ] Mobile app

---

## 📄 Licenza

Copyleft 2026 - Progetto Borderò

---

**Buona luck! 🎭🎵**

Per domande dettagliate sul progetto, controlla il file di estrazione:  
👉 `../REPORT_ESTRAZIONE_BORDERO.md`

