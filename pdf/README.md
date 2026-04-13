# PDF Management System

Sistema dedicato alla gestione e visualizzazione PDF nel progetto VSC_Live_Server.

## Struttura

```
pdf/
├── servers/           # Server Node.js per API PDF
│   └── pdf-server-simple.js
├── scripts/           # Script PowerShell per gestione
│   ├── start-pdf-server.ps1
│   ├── stop-pdf-server.ps1
│   └── update_pdf_list.ps1
├── viewers/           # Interfacce web per visualizzazione
│   ├── ScriptPDF1.html      # Viewer principale
│   └── pdf-viewer.html      # Viewer embed
├── config/            # File di configurazione e stato
│   └── opened-viewers.json
└── README.md          # Questa documentazione
```

## Server Attivo

Il sistema PDF è integrato nel **unified-server.js** (porta 5500) avviato automaticamente.

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
- I viewer si aprono in modalità kiosk sul monitor secondario
- Stato dei viewer tracciato in `config/opened-viewers.json`