# USERFORM Section Scaffold

This section is a standalone scaffold for the USERFORM area.

Goals for this first step:
- Keep USERFORM navigation separate from BORDERO runtime pages while reusing its read-only catalogue through explicit APIs.
- Mirror the VBA UserForm group from the workbook version 13.1.72.
- Provide ordered HTML placeholders to develop page-by-page later.

Current scope:
- Static infrastructure + first functional page (INDICE).
- SCALETTA reads the Bordero catalogue without modifying it and saves playlists to the project-relative `VSC_PRESELEZIONE/` folder.

Development status:
- INDICE: first-pass web porting completed with grouped action hub.
- PAGINA01: converted (navigation, combo init group, Prova/PDF action).
- PAGINA02: converted (listbox group, TextBox6 sync preview, external launchers).
- PAGINA03: converted (report generation group, D2 binding, report views).
- PAGINA04: converted (display/public/mobile launcher groups).
- PAGINA05: converted (camera profile, FFmpeg recording flow, VLC live controls).
- COLLEGAMENTI: Google Forms/Sheets/Drive link hub with image previews.
- PAGINA07: converted (webcam preview, rec timer, open last video flow).
- SCRIPT-PDF: Bordero-styled launcher for the single canonical `/pdf/pages/script-pdf-gestione.html` workbench. In Electron, PDFs open in a temporary always-on-top viewer over DISPLAY and closing the viewer restores DISPLAY. The old Prova URL redirects to Gestione.
- PAGINA09: converted (Bordero/Eventi bridge launchers).
- PAGINA10: converted (DASH + UI timer controls with auto-start behavior).
- PAGINA11: delegata alla pagina gia completa Bordero/pages/location.html (link bridge).
- SCALETTA: generatore scaletta country with JSON files saved to `VSC_PRESELEZIONE/` and imported directly by Preselezione DJ.

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
