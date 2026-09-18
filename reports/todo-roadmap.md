# Integration Final - ToDo e Roadmap

## Stato attuale

- [x] Branch di lavoro: `integration-final`
- [x] Base dominante: `portability-stabilization`
- [x] Sorgente analizzata in sola lettura: `origin/daniele-local`
- [x] `git fetch --all` eseguito
- [x] Merge-base identificato: `07b4901ea345882b048f0a7af908c641ad2d4b83`
- [x] Report iniziali generati
- [x] Nessuna modifica della sorgente applicata
- [ ] Decisioni utente completate: 480 elementi WARNING/CRITICAL pendenti
- [ ] Revisione obbligatoria dei 20 elementi CRITICAL

## Fase 1 - Decisioni non ambigue

Proposta da confermare:

- [ ] WARNING di tipo `D`: `BASE` (268 elementi)
- [ ] WARNING di tipo `M`: `COMBINA` (143 elementi)
- [ ] WARNING di tipo `A`: `DANIELE` (18 elementi)
- [ ] WARNING raccomandati `MANUALE`: revisione singola (31 elementi)
- [ ] SAFE: applicazione secondo raccomandazione, senza revisione tecnica estesa

Criterio: le decisioni aggregate sono applicabili solo dopo conferma esplicita dell'utente.

## Fase 2 - Revisione ad alto rischio

Per ogni elemento CRITICAL e WARNING manuale:

- [ ] Confrontare versione BASE e versione DANIELE
- [ ] Verificare dipendenze, configurazioni e riferimenti incrociati
- [ ] Registrare una decisione tra `BASE`, `DANIELE`, `COMBINA`, `SCARTA`, `MANUALE`
- [ ] Annotare l'impatto in `reports/apply-log.md`

Aree prioritarie:

- `package.json` e `package-lock.json`
- `electron/`
- `config/`, `auth/`, `sync/`, `firebase/`
- file `.env*`, sicurezza e Google sync
- script PowerShell

## Fase 3 - Applicazione controllata

- [ ] Aggiornare `reports/merge-decisions.json`
- [ ] Applicare solo decisioni compilate
- [ ] Per `BASE` o `SCARTA`, mantenere la versione della base
- [ ] Per `DANIELE`, importare la versione dalla sorgente remota
- [ ] Per `COMBINA`, risolvere manualmente i blocchi sovrapposti
- [ ] Per `MANUALE`, fermarsi e aprire il confronto prima di modificare
- [ ] Dopo ogni gruppo: eseguire `git status`
- [ ] Aggiornare `reports/apply-log.md`

## Fase 4 - Validazione tecnica

- [ ] Verificare conflitti Git irrisolti
- [ ] Validare tutti i JSON
- [ ] Validare `package.json` e coerenza del lockfile
- [ ] Controllare sintassi JavaScript/TypeScript
- [ ] Controllare import e file referenziati
- [ ] Verificare configurazioni Firebase ed Electron
- [ ] Aggiornare `reports/validation-report.md`

## Fase 5 - Test funzionali

- [ ] Node/server: avvio e moduli richiesti
- [ ] Electron: avvio, preload, policy e monitor preferences
- [ ] Frontend: pagine principali, CSV e sincronizzazione
- [ ] PowerShell: parsing e percorsi usati dagli script
- [ ] Classificare ogni controllo come `PASS`, `WARNING` o `FAIL`
- [ ] Nessun `FAIL` aperto

## Fase 6 - Revisione finale

- [ ] Generare/aggiornare `reports/high-risk-changes.md`
- [ ] Ottenere revisione obbligatoria dell'utente sui rischi residui
- [ ] Aggiornare `reports/final-report.md`
- [ ] Verificare che base e sorgente non siano state modificate
- [ ] Verificare che non restino decisioni `PENDING`
- [ ] Confermare worktree e contenuto del commit previsto

## Fase 7 - Commit finale

Da eseguire solo quando tutte le decisioni sono compilate, non ci sono `FAIL` o conflitti e la revisione high-risk è conclusa:

```text
Integration Final:
portability-stabilization + selected changes from daniele-local
```

- [ ] `git add .`
- [ ] `git commit` con il messaggio indicato
- [ ] Verificare log e stato finale
- [ ] Non eseguire push automatico

## Documenti di riferimento

- [analysis-summary.md](analysis-summary.md)
- [merge-decision-table.md](merge-decision-table.md)
- [merge-decisions.json](merge-decisions.json)
- [merge-dashboard.html](merge-dashboard.html)
- [high-risk-changes.md](high-risk-changes.md)
- [validation-report.md](validation-report.md)
- [final-report.md](final-report.md)
