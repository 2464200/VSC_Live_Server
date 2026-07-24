# Documentazione Operativa — Eventi

> 📌 Questa documentazione fa parte della [guida unificata del progetto](../README.md).


Torna all'indice generale: [DOCUMENTATION.md](DOCUMENTATION.md)

Indice:
- [Panoramica](#panoramica)
- [Avvio e URL utili](#avvio-e-url-utili)
- [Operazioni quotidiane](#operazioni-quotidiane)
- [Troubleshooting rapido](#troubleshooting-rapido)
- [Sezioni correlate](#sezioni-correlate)

---

## Panoramica
Il modulo `Eventi` gestisce prenotazione, esecuzione e monitoraggio delle coreografie DJ.

Le pagine client si trovano in `Eventi/public/`.

## Avvio e URL utili
- Home Eventi: `http://localhost:5500/eventi/eventi.html`
- Prenotati: `http://localhost:5500/eventi/prenotati.html`
- Eseguiti: `http://localhost:5500/eventi/spuntati.html`
- Non eseguiti: `http://localhost:5500/eventi/non-spuntati.html`
- Tutti: `http://localhost:5500/eventi/tutti.html`
- Coreografie Aggiuntive: `http://localhost:5500/eventi/coreografie-aggiuntive.html`
- Statistiche DJ: `http://localhost:5500/eventi/statistiche-dj.html`
- Visualizer: `http://localhost:5500/eventi/visualizer.html`

Avvio consigliato:
1. apri il progetto root in VS Code
2. esegui `startup.ps1`
3. apri `http://localhost:5500/eventi/eventi.html`

## Operazioni quotidiane
- Seleziona il DJ dall'elenco in `eventi.html`.
- Prenota un brano in `eventi.html` spuntando la checkbox; lo stato diventa `prenotato`.
- Marcia come eseguito in `prenotati.html` cliccando `Eseguito`.
- Usare `tutti.html`, `spuntati.html` e `non-spuntati.html` per filtri alternativi.

## Troubleshooting rapido
- Verifica API: `http://localhost:5500/eventi/api/ping`
- Diagnostica: `http://localhost:5500/diagnostica.html`
- Sincronizza brani: `node Eventi/sync-brani.js`
- Se la pagina non aggiorna, prova a ricaricare il browser o a riavviare il server.

## Workflow Git operativo

Prima di modifiche operative in ambiente locale:

```powershell
git fetch --all --prune
git checkout develop
git pull origin develop
```

Per pubblicare:

```powershell
git add -A
git commit -m "docs: aggiornamento documentazione operativa eventi"
git push
```

Promozione release consigliata: `develop` verso `main` via Pull Request.

## Sezioni correlate
- [Gestione DJ e Sicurezza](DOCUMENTATION_ADMIN.md)
- [Architettura e API](DOCUMENTATION_DEVELOPMENT.md)

