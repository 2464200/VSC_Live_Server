**⚠️ Nota importante:** a partire dal 13 Apr 2026 il flusso standard del progetto usa un unico unified-server.js su http://localhost:5500. Le architetture con server-manager.js, pdf-server.js, simple-server.js, static-server.js, pdf-server-simple.js e le porte 3000, 3010, 8765 sono ora legacy/historiche e non fanno parte del percorso standard.

# âœ… SOLUZIONE STABILE E FUNZIONANTE - ScriptPDF1

> Stato attuale: `ScriptPDF1` usa il server unificato su `http://localhost:5500`.
> I fallback su `8765` e `3000` in questa pagina descrivono la soluzione storica precedente.

## ðŸ“‹ Cosa Ã¨ stato RISOLTO

### âœï¸ **Nuovi file creati:**

1. **`api-config.js`** - Configurazione API dinamica
   - Rileva automaticamente `window.location.hostname`
   - Tenta multiple porte (8765, 5500, 3000)
   - Retry automatico con timeout configurabile
   - Metodo `fetchAPI()` per tutte le richieste

2. **`ScriptPDF1.html`** - Riportato aggiornato
   - Include `<script src="../api-config.js"></script>`
   - Usa `window.APIConfig.detectAvailablePort()` al caricamento
   - Tutti i fetch via `window.APIConfig.fetchAPI()`
   - Rilevamento dinamico host/porta
   - Auto-fallback a diverse porte

---

## ðŸ”§ Come funziona il sistema

### **1. Rilevamento dinamico della porta**

All'avvio della pagina (DOMContentLoaded):
```javascript
const port = await window.APIConfig.detectAvailablePort();
// Tenta 8765, poi 5500, poi 3000
```

### **2. Fetch con retry automatico**

Tutte le richieste API usano:
```javascript
const response = await window.APIConfig.fetchAPI('/api/pdf-list');
// Automaticamente con:
// - Timeout: 5 secondi
// - Retry: 2 tentativi
// - Backoff esponenziale: 500ms, 1000ms
```

### **3. Fallback intelligente**

```
Prova porta 8765
  â†“ (fallisce?)
Prova porta 5500
  â†“ (fallisce?)
Prova porta 3000
  â†“ (fallisce?)
Mostra errore con istruzioni
```

---

## ðŸš€ Come usare

### **Avvio del server PDF:**

```powershell
npm start
# Oppure
node pdf-server.js
# Oppure
.\start-pdf-server.ps1
```

Default: Ascolta sulla **porta 8765**

### **Apertura di ScriptPDF1.html:**

Tramite VSCode Live Server:
```
http://localhost:5500/Prova/ScriptPDF1.html
```

Il sistema automaticamente:
1. Rileva che sei su `localhost`
2. Tenta di connettersi a `localhost:8765`
3. Se disponibile, carica i PDF
4. Se non disponibile, mostra messaggio di errore

---

## âœ… Vantaggi della nuova soluzione

| Aspetto | Prima âŒ | Dopo âœ… |
|---------|---------|--------|
| **Host statici** | Hardcoded `127.0.0.1` | Dinamico da `window.location` |
| **Porta statica** | Solo 8765 | Tenta 8765 â†’ 5500 â†’ 3000 |
| **Error handling** | Messaggi confusi | Messaggi chiari + istruzioni |
| **Retry** | Senza retry | 2 retry con backoff |
| **Timeout** | Timeout lungo | Timeout 5s configurabile |
| **Auto-detect** | Manuale | Automatico |

---

## ðŸ“Š Architettura

```
Browser
  â”‚
  â”œâ”€ HTML
  â”‚  â””â”€ api-config.js (detects host:port)
  â”‚
  â”œâ”€ Fetch localhost:8765 (or 5500, or 3000)
  â”‚  â”œâ”€ Timeout: 5 secondi
  â”‚  â”œâ”€ Retry: 2 volte
  â”‚  â””â”€ Fallback: diverse porte
  â”‚
  â”œâ”€ PDF Server
  â”‚  â”œâ”€ localhost:8765 (default)
  â”‚  â”œâ”€ Express + CORS
  â”‚  â”œâ”€ /api/pdf-list
  â”‚  â”œâ”€ /api/open-pdf
  â”‚  â””â”€ /api/close-chrome
  â”‚
  â””â”€ Live Server
     â”œâ”€ localhost:5500
     â”œâ”€ HTML static files
     â”œâ”€ CSV files
     â””â”€ api-config.js
```

---

## ðŸ§ª Test di verifica

### **Apri la console browser (F12)**

Dovresti vedere:

```
ðŸ“ ScriptPDF1 - Configurazione dinamica
   Host: localhost
   Protocol: http:
   Porte da provare: 8765, 5500, 3000
   ðŸ’¡ Assicurati che pdf-server sia avviato: npm start

ðŸš€ DOM Ready - Inizializzazione ScriptPDF1
ðŸ” Rilevamento host: localhost
âœ… PDF Server rilevato su porta 8765
ðŸ“š Caricamento lista PDF...
âœ… X PDF caricati
Pronto - X PDF disponibili
```

### **Se vedi errori:**

```
âŒ Server PDF non trovato - Tentativo auto-start...
âš ï¸ Server PDF non disponibile
```

â†’ Significa che il PDF Server non Ã¨ avviato
â†’ Esegui: `npm start` o `.\start-pdf-server.ps1`

---

## ðŸ”Œ Porte disponibili

| Porta | Servizio | Default |
|-------|----------|---------|
| **5500** | Live Server (VSCode) | âœ“ |
| **8765** | PDF Server | âœ“ |
| **3000** | Fallback | Opzionale |

Se vuoi usare una porta diversa:

```powershell
$env:PDF_SERVER_PORT = 3000
npm start
```

---

## ðŸ“ File sorgente

- **api-config.js** - Logica di rilevamento (100 righe)
- **ScriptPDF1.html** - UI aggiornata con api-config.js
- **pdf-server.js** - Backend Node.js (porta 8765 default)

Tutti gli altri file rimangono invariati.

---

## âœ¨ Status finale

```
âœ… STABILE E COMPLETAMENTE FUNZIONANTE

âœ“ Host dinamico (window.location)
âœ“ Porta dinamica (multiple fallback)
âœ“ Retry automatico
âœ“ Timeout configurabile
âœ“ Error handling robusto
âœ“ Nessun hardcoding

PRONTO AL DEPLOY! ðŸš€

---

## ðŸ§¹ Linee guida per mantenere il codice pulito
Per evitare warning, errori in fase di editing e garantire che il progetto rimanga leggibile
nel tempo, segui questi semplici consigli:

1. **Niente righe estranee nei CSS/JS**
   - Non lasciare istruzioni VBA/`Print #fileHTML` o testo non pertinente nei fogli di
     stile. Queste causano errori nel Problems view.
   - Un semplice `grep -R "Print #fileHTML" .` nella root segnala eventuali residui.

2. **Commenti e TODO**
   - Usa i commenti `// TODO` o `/* FIXME */` per annotare lavoro in sospeso e
     rimuovili quando non sono piÃ¹ necessari.
   - Evita di conservare codice commentato per mesi; se serve, spostalo in
     `archivio/` o in un backup separato.

3. **Condivisione del CSS**
   - Le pagine HTML usano tutti `style.css`. Inserisci stili comuni lÃ¬ e mantieni
     il file snello; se serve un override locale, aggiungilo inline vicino alla
     porzione interessata.

4. **Verifiche automatiche**
   - Integra un task `npm run lint` o un preâ€‘commit hook che lanci `stylelint`/
     `eslint` oppure le ricerche di cui sopra.
   - Un controllo di base potrebbe essere:
     ```powershell
     if (grep -R "Print #fileHTML" .) { throw "Sanifica il CSS prima di committare" }
     ```

5. **Archiviazione storica**
   - La cartella `archivio/` contiene materiale vecchio: va tenuta fuori dalla
     distribuzione o rimossa se non serve.

Seguendo queste regole il repository rimane leggero, privo di errori di linting
e piÃ¹ facile da capire per chiunque dovrÃ  intervenire in futuro.

```

---

**Data**: 20 Febbraio 2026  
**Versione**: 2.0.0-dynamic  
**Status**: âœ… LIVE


