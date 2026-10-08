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
â”œâ”€â”€ pages/             # Pagine ScriptPDF con nomenclatura descrittiva
â”‚   â”œâ”€â”€ script-pdf-gestione.html # Workbench canonico
â”‚   â””â”€â”€ script-pdf-prova.html    # Redirect compatibile
â”œâ”€â”€ viewers/           # Componenti di visualizzazione
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
- `GET /api/serve-pdf?file=...` - Serve in modo inline un PDF della cartella configurata per l'anteprima

## Viewer

- **/pdf/pages/script-pdf-gestione.html**: pagina principale per gestione PDF, ricerca, filtri, cronologia e anteprima.
- **/pdf/pages/script-pdf-prova.html**: redirect di compatibilità verso la pagina canonica.
- I vecchi URL `/ScriptPDF1.html`, `/Prova/ScriptPDF1.html`, `/pdf/viewers/ScriptPDF1.html` e `/pdf/pages/script-pdf-prova.html` restano compatibili.
- La pagina canonica usa `pdf/assets/scriptpdf-workbench.css` e `pdf/assets/scriptpdf-workbench.js`.
- **pdf/viewers/pdf-viewer.html**: componente embed per visualizzazione.

La pagina canonica gestisce selezione, ricerca, filtri, anteprima e cronologia locale. In Electron il pulsante apre il PDF in una finestra temporanea always-on-top sul monitor secondario, sopra DISPLAY; il pulsante Chiudi o ESC ripristina DISPLAY. Nei browser normali resta disponibile l'apertura tramite Acrobat/Chrome. La chiusura remota riguarda solo le sessioni esterne registrate come avviate da ScriptPDF.

Il server usa `C:\VSC_SCRIPT_PDF` come directory predefinita su Windows; `VSC_SCRIPT_PDF_DIR` in `.env` può cambiarla intenzionalmente. L'endpoint di apertura e quello di anteprima verificano che il file sia un PDF interno alla directory configurata, inclusi i collegamenti simbolici.

ADMIN espone la sola pagina canonica come finestra temporanea sul monitor secondario. La sincronizzazione Hosting mantiene la pagina, il redirect compatibile e gli asset condivisi in `public/`.

## Note

- Su Windows, i PDF sono letti per impostazione predefinita dalla cartella `C:\VSC_SCRIPT_PDF`
- I viewer si aprono in modalitÃ  kiosk sul monitor secondario
- Stato dei viewer tracciato in `config/opened-viewers.json`
