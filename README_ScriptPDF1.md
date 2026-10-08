# ScriptPDF

Questa guida sostituisce le istruzioni storiche associate al nome `ScriptPDF1`.
La documentazione operativa aggiornata è mantenuta in [pdf/README.md](pdf/README.md).

## Pagine canoniche

- `/pdf/pages/script-pdf-gestione.html` — gestione principale di `C:\VSC_SCRIPT_PDF`, con ricerca, filtri, anteprima e cronologia.
- `/pdf/pages/script-pdf-prova.html` — ambiente di prova con le stesse funzioni.
- `/USERFORM/pages/SCRIPT-PDF.html` — launcher USERFORM con miniature.

Gli URL storici `/ScriptPDF1.html`, `/Prova/ScriptPDF1.html` e
`/pdf/viewers/ScriptPDF1.html` rimangono disponibili come redirect di
compatibilità. I PDF sono serviti e aperti dal `unified-server.js` su porta
5500; la directory può essere personalizzata tramite `VSC_SCRIPT_PDF_DIR`.

ADMIN ed Electron elencano e gestiscono i due percorsi canonici sul monitor 1.
