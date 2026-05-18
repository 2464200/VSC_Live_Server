# Documentazione Amministrativa — Eventi

Torna all'indice generale: [DOCUMENTATION.md](DOCUMENTATION.md)

Indice:
- [Gestione DJ e Sicurezza](#gestione-dj-e-sicurezza)
- [Amministrazione e CSV](#amministrazione-e-csv)
- [Note sulla password di sistema](#note-sulla-password-di-sistema)
- [Sezioni correlate](#sezioni-correlate)

---

## Gestione DJ e Sicurezza
- La selezione del DJ in `eventi.html` ora richiede conferma tramite password di sistema.
- Se la password non viene confermata o è errata, la selezione viene annullata e resta attivo il DJ precedente.
- Questa protezione evita che un operatore possa cambiare DJ senza autorizzazione.

## Amministrazione e CSV
- File dati principali:
  - `Eventi/Elenco_Brani_statico.csv`
  - `Eventi/Coreografie_Aggiuntive.csv`
  - `Eventi/data/*.json`
- La pagina `coreografie-aggiuntive.html` gestisce il caricamento, la modifica e l'eliminazione dei brani aggiuntivi.
- Le operazioni sensibili come l'export CSV o il reset dei tempi richiedono la password di sistema.

## Note sulla password di sistema
- La password di sistema è centralizzata in `Eventi/public/config.js`.
- Valore attuale: `window.SYSTEM_PASSWORD = '0000'`.
- Questa impostazione garantisce che tutte le pagine del modulo Eventi usino la stessa password condivisa.

## Sezioni correlate
- [Operazioni quotidiane](DOCUMENTATION_OPERATIONS.md)
- [Architettura e API](DOCUMENTATION_DEVELOPMENT.md)
