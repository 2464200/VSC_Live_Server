# ScriptPDF

Questa guida sostituisce le istruzioni storiche associate al nome `ScriptPDF1`.
La documentazione operativa aggiornata è mantenuta in [pdf/README.md](pdf/README.md).

## Pagine canoniche

- `/pdf/pages/script-pdf-gestione.html` — gestione principale di `C:\VSC_SCRIPT_PDF`, con ricerca, filtri, anteprima e cronologia.
- La griglia di `USERFORM/index.html` apre direttamente `/pdf/pages/script-pdf-gestione.html` per il form `SCRIPT-PDF`; non c'è una pagina intermedia.
- La pagina di gestione resta sul monitor principale; il viewer del documento si apre temporaneamente sul monitor secondario, sopra DISPLAY.

Gli URL storici `/ScriptPDF1.html`, `/Prova/ScriptPDF1.html` e
`/pdf/viewers/ScriptPDF1.html` rimangono disponibili come redirect di
compatibilità. I PDF sono serviti e aperti dal `unified-server.js` su porta
5500; la directory può essere personalizzata tramite `VSC_SCRIPT_PDF_DIR`.

ADMIN ed Electron elencano la pagina canonica sul monitor principale e il viewer PDF sul monitor secondario.
