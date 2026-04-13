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

- **ScriptPDF1.html**: Interfaccia principale per gestione PDF
- **pdf-viewer.html**: Componente embed per visualizzazione

## Note

- I PDF sono letti dalla cartella `C:\VSC_SCRIPT_PDF`
- I viewer si aprono in modalitÃ  kiosk sul monitor secondario
- Stato dei viewer tracciato in `config/opened-viewers.json`

