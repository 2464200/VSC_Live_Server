# USERFORM — Pagine operative

USERFORM è il modulo di pagine operative HTML servito dal server unificato del progetto.

Goals for this first step:
- Keep USERFORM navigation separate from BORDERO runtime pages while reusing its read-only catalogue through explicit APIs.
- Mirror the VBA UserForm group from the workbook version 13.1.72.
- Provide ordered HTML placeholders to develop page-by-page later.

Current scope:
- Indice USERFORM e moduli operativi convertiti in pagine HTML.
- SCALETTA reads the Bordero catalogue without modifying it and saves playlists to the project-relative `Preselezione/` folder.

Development status:
- INDICE: first-pass web porting completed with grouped action hub.
- PAGINA01: converted (navigation, combo init group, Prova/PDF action).
- PAGINA02: converted (listbox group, TextBox6 sync preview, external launchers).
- PAGINA03: converted (report generation group, D2 binding, report views).
- PAGINA04: converted (display/public/mobile launcher groups).
- PAGINA05: converted (camera profile, FFmpeg recording flow, VLC live controls).
- COLLEGAMENTI: Google Forms/Sheets/Drive link hub with image previews.
- PAGINA07: converted (webcam preview, rec timer, open last video flow).
- SERVIZIO: pagina operatore per testo, immagini, presentazioni e video. Il testo pubblicato è centrato e ridimensionato per l'area; font predefinito Segoe UI, dimensione predefinita Auto. I selettori permettono di scegliere un font installato sul PC del monitor 2 e una dimensione massima; il fitting riduce il font se necessario. Il font non viene installato né trasferito al monitor.
- SCRIPT-PDF: the USERFORM index opens `/USERFORM/pages/SCRIPT-PDF.html` directly. The workbench stays on the primary monitor, while Electron opens PDFs in a temporary always-on-top viewer over DISPLAY and restores DISPLAY when it closes. `/pdf/pages/script-pdf-gestione.html` remains a compatibility redirect.
- REGISTRO COREOGRAFIE: pagina con accesso al progetto e alla base dati Google. Entrambi i pulsanti aprono una nuova scheda nel browser predefinito, come collegamenti esterni standard.
- PAGINA09: converted (Bordero/Eventi bridge launchers).
- PAGINA10: converted (DASH + UI timer controls with auto-start behavior).
- PAGINA11: delegata alla pagina gia completa Bordero/pages/location.html (link bridge).
- SCALETTA: generatore scaletta country with JSON files saved to `Preselezione/` and imported directly by Preselezione DJ.

Canonical SCALETTA catalogue levels: BASE, INTERMEDIO, AVANZATO 1, AVANZATO 2, SUPER AVANZATO 1+2, SUPER AVANZATO 3, ALTRE COREO.

Mapped VBA forms:
- INDICE
- PAGINA01
- PAGINA02
- PAGINA03
- PAGINA04
- PAGINA05
- COLLEGAMENTI
- PAGINA07
- SCRIPT-PDF
- PAGINA09
- PAGINA10
- PAGINA11
- SCALETTA

Entry point:
- Open ./index.html from the USERFORM folder.

## Regola del monitor secondario

Quando USERFORM è aperto tramite Electron, DISPLAY resta la pagina persistente del monitor 2 dietro agli overlay di presentazione. Una nuova pagina gestita sostituisce e chiude l'overlay precedente; DISPLAY rimane disponibile in background, salvo chiusura manuale autorizzata dalla pagina Borderò. La policy e i test di routing sono descritti in [GUIDA_USO_PROGETTO.md](../GUIDA_USO_PROGETTO.md).

Per pubblicare modifiche USERFORM sul sito, aggiornare i file pubblicati previsti dal progetto con `npm run sync:public`; non creare copie pubbliche ad hoc per pagine che non sono incluse nel flusso di sincronizzazione.
