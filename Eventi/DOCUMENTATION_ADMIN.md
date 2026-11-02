# Documentazione Amministrativa — Eventi

> 📌 Questa documentazione fa parte della [guida unificata del progetto](../README.md).


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
- Il pulsante `Borderò single DJ` richiede la password di sistema prima della navigazione a `/Bordero/pages/bordero.html`. Se l'utente annulla o il codice è errato, l'accesso tramite quel pulsante viene bloccato.

## Amministrazione e CSV
- File dati principali:
  - `Eventi/Elenco_Brani_statico.csv`
  - `Eventi/Coreografie_Aggiuntive.csv`
  - `Eventi/data/*.json`
- La pagina `coreografie-aggiuntive.html` gestisce il caricamento, la modifica e l'eliminazione dei brani aggiuntivi.
- Le operazioni sensibili come l'export CSV o il reset dei tempi richiedono la password di sistema.

## Note sulla password di sistema
- La password di sistema è centralizzata in `Eventi/public/config.js`.
- Questa impostazione garantisce che tutte le pagine del modulo Eventi usino la stessa password condivisa.
- La verifica è client-side e protegge il flusso dell'interfaccia; non è un'autorizzazione server-side e non impedisce l'accesso diretto alle pagine o alle API.

## Nota runtime e Git

- Runtime standard progetto: `http://localhost:5500` con `unified-server.js`.
- Prima di modifiche amministrative: `git fetch --all --prune`, poi `git checkout develop` e `git pull origin develop`.
- Guida completa: `../GUIDA_GIT_MAIN_DEVELOP.md`.

## Sezioni correlate
- [Operazioni quotidiane](DOCUMENTATION_OPERATIONS.md)
- [Architettura e API](DOCUMENTATION_DEVELOPMENT.md)
