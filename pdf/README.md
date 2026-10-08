> 📌 Questa documentazione fa parte della [guida unificata del progetto](../README.md).

**⚠️ Nota importante:** a partire dal 13 Apr 2026 il flusso standard del progetto usa un unico unified-server.js su http://localhost:5500. Le architetture con server-manager.js, pdf-server.js, simple-server.js, static-server.js, pdf-server-simple.js e le porte 3000, 3010, 8765 sono ora legacy/historiche e non fanno parte del percorso standard.

# PDF Management System

Sistema dedicato alla gestione e visualizzazione PDF nel progetto VSC_Live_Server.

## Struttura

```
pdf/
â”œâ”€â”€ servers/           # Server Node.js per API PDF
â”‚   â””â”€â”€ pdf-server-simple.js
â”œâ”€â”€ scripts/           # Script PowerShell per gestione
â”‚   â”œâ”€â”€ start-pdf-server.ps1
â”‚   â”œâ”€â”€ stop-pdf-server.ps1
â”‚   â””â”€â”€ update_pdf_list.ps1
â”œâ”€â”€ viewers/           # Interfacce web per visualizzazione
â”‚   â”œâ”€â”€ ScriptPDF1.html      # Viewer principale
â”‚   â””â”€â”€ pdf-viewer.html      # Viewer embed
â”œâ”€â”€ config/            # File di configurazione e stato
â”‚   â””â”€â”€ opened-viewers.json
â””â”€â”€ README.md          # Questa documentazione
```

## Server Attivo

Il sistema PDF Ã¨ integrato nel **unified-server.js** (porta 5500) avviato automaticamente.

### Endpoint API
- `GET /api/pdf-list` - Lista PDF da C:\VSC_SCRIPT_PDF
- `POST /api/open-pdf` - Apre PDF in Chrome (monitor secondario)
- `POST /api/close-chrome` - Chiude tutti i viewer
- `GET /api/opened-viewers` - Stato viewer aperti

## Viewer

- **/ScriptPDF1.html**: gestione PDF principale, collegata al modulo USERFORM e gestita da Electron sul monitor principale.
- **/Prova/ScriptPDF1.html**: ambiente di prova, con tentativi ripetuti per la connessione al server.
- Entrambe le pagine usano `pdf/assets/scriptpdf-workbench.css` e `pdf/assets/scriptpdf-workbench.js`.
- **pdf/viewers/pdf-viewer.html**: componente embed per visualizzazione.

Le pagine riprendono dal progetto VBA la cartella `C:\VSC_SCRIPT_PDF`, la selezione e navigazione dell'elenco, la scelta del viewer e l'apertura sul monitor secondario. La pagina di prova mantiene un secondo tentativo di connessione. La chiusura remota richiede conferma e riguarda solo le sessioni registrate come avviate da ScriptPDF.

ADMIN pubblica entrambe le pagine nel pannello delle route monitor. La sincronizzazione Hosting mantiene le copie in `public/` e gli asset condivisi.

## Note

- I PDF sono letti dalla cartella `C:\VSC_SCRIPT_PDF`
- I viewer si aprono in modalitÃ  kiosk sul monitor secondario
- Stato dei viewer tracciato in `config/opened-viewers.json`

