# Documentazione Tecnica — Eventi

> 📌 Questa documentazione fa parte della [guida unificata del progetto](../README.md).


Torna all'indice generale: [DOCUMENTATION.md](DOCUMENTATION.md)

Indice:
- [Architettura e Sviluppo](#architettura-e-sviluppo)
- [Endpoint API principali](#endpoint-api-principali)
- [File rilevanti](#file-rilevanti)
- [Sezioni correlate](#sezioni-correlate)

---

## Architettura e Sviluppo
- Il flusso standard del progetto usa il server unificato `unified-server.js` su porta `5500`.
- Il modulo `Eventi` espone API e pagine frontend in `Eventi/public/`.
- Il router legacy `Eventi/eventi-server.js` esiste per storicità ma non è parte del percorso standard.

## Endpoint API principali
Base: `http://localhost:5500/eventi/api`
- `GET /brani`
- `GET /log`
- `POST /log`
- `POST /log/reset-times`
- `GET /dj`
- `POST /dj`
- `DELETE /dj/:id`
- `GET /export-csv`
- `POST /check-prenotazione-limit`
- `POST /aggiuntive/update`
- `POST /aggiuntive/delete`

## File rilevanti
- `Eventi/public/eventi.html`
- `Eventi/public/eventi.js`
- `Eventi/public/style.css`
- `Eventi/public/config.js`
- `Eventi/brani-utils.js`
- `Eventi/Elenco_Brani_statico.csv`
- `Eventi/Coreografie_Aggiuntive.csv`

## Sezioni correlate
- [Operazioni quotidiane](DOCUMENTATION_OPERATIONS.md)
- [Gestione DJ e Sicurezza](DOCUMENTATION_ADMIN.md)

