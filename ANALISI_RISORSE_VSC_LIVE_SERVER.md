# Analisi risorse VSC_Live_Server

Data rilevazione: 2026-10-10. Analisi diagnostica di sola lettura. Nessun processo e stato arrestato, nessuna impostazione e stata modificata e non e stato eseguito alcun deploy.

## 1. Sintesi esecutiva

- Il server standard `unified-server.js` e attivo sulla porta 5500, PID 25436, con circa 144 MB di RAM nello snapshot. CPU osservata: 0% nel campione.
- Il deploy Firebase locale automatico e abilitato e controlla il contenuto ogni 60 secondi. L'utente ha confermato di mantenerlo cosi com'e. All'ultimo controllo non stava pubblicando: il risultato era "Nessuna modifica: deploy saltato".
- Il workflow GitHub Actions `.github/workflows/firebase-hosting-merge.yml` pubblica gia il branch `develop`. Il timer locale puo essere ridondante per le modifiche committate, ma puo coprire modifiche locali.
- Il file `.firebase/deploy-control.json` dichiara i flag deploy a `false`, ma manca la versione richiesta dal parser. Il parser risolve quindi il timer come abilitato; lo stato live conferma `intervalEnabled: true`. L'utente ha confermato di mantenere il comportamento attuale, quindi il file non e stato corretto.
- Il sync Google Bordero e configurato ogni 60 secondi e il suo ultimo ciclo osservato era riuscito.
- VS Code riporta 979 MB per l'Extension Host e 136 MB per il file watcher. Il consumo per singola estensione non e disponibile.
- Task Scheduler e le cartelle standard di avvio sono stati controllati in sola lettura: nessun riferimento diretto al percorso del progetto o ai suoi script e stato trovato.
- Non e stata applicata alcuna ottimizzazione; non esiste una misura prima/dopo.

## 2. Inventario

| Elemento | Evidenza e funzione | Stato/limiti |
|---|---|---|
| Server locale | `unified-server.js`, porta 5500; integra web, PDF, Eventi e API | Listener attivo, PID 25436, circa 144 MB RAM |
| Avvio VS Code | `.vscode/tasks.json` avvia `startup-retry.ps1 -NoMonitor` su `folderOpen` | Task indicato in esecuzione; output del task vuoto |
| Chiusura VS Code | Task nascosto su `folderClose` esegue `shutdown.ps1` | Non eseguito. Lo script termina processi forzatamente e sincronizza CSV |
| Altri task | Riavvii, Electron, Git, backup, aggiornamento strumenti, deploy | Configurati ma non attribuiti come attivi |
| Server Live Server | Estensione installata, porta configurata 5503 | Nessun listener su 5503 nello snapshot |
| Deploy locale | `unified-server.js`, timer ogni 60 secondi | Abilitato; ultimo ciclo saltato per assenza modifiche |
| Deploy GitHub | Workflow su push a `develop` | Configurato su Firebase Hosting |
| Sync Google Bordero | Scheduler nello Unified Server | Ogni 60 secondi; ultimo ciclo periodico riuscito |
| Watcher cloud-sync | `Bordero/server/firebase-cloud-sync.js`, tre file CSV mirati | Watcher puntuali, `unref()`; attività CPU non misurata |
| VS Code | Extension Host, file watcher, window, agent/shared/GPU process | Snapshot nativo; dati complessivi, non attribuiti a questo workspace o a singole estensioni |
| Terminali | Processi PowerShell e OpenConsole figli di Code | Snapshot ha mostrato 33 processi per tipo sotto alberi Code; associazione al singolo workspace non dimostrata |
| Estensioni pertinenti | Python, Pylance, Python Environments, Debugpy, PowerShell, Live Server, Rainbow CSV, Office/Excel, AutoHotkey, GitHub Actions | Installate; misurazione individuale N/D |
| File e cartelle | `node_modules`: 24.528 file/0,60 GB; `.venv`: 1.288 file/0,01 GB; `logs`: 0,03 GB; `archivio`: 0,01 GB | Scansione mirata; nessun video o archivio comune trovato con le estensioni cercate |
| JSON cache Firebase | Sei file JSON in `.firebase` | Tutti ignorati da Git, nessuno tracciato; contenuti e nomi non letti/riportati |
| Attivita pianificate esterne | Task Scheduler e Startup folder utente/sistema | Nessuna azione collegata direttamente al progetto rilevata |

Estensioni VS Code elencate come pertinenti non sono state disabilitate. Non e stato possibile misurare il consumo per estensione o stabilire con certezza quali siano attive nello scenario corrente.

## 3. Tabella delle attivita

| ID | Processo/attivita | Funzione | RAM osservata | CPU osservata | Frequenza/durata | Necessita operativa | Categoria | Rischio di disattivazione | Intervento consigliato | Ripristino |
|---|---|---|---:|---:|---|---|---|---|---|---|
| P1 | `node.exe`, PID 25436 | Unified Server, porta 5500 | 144 MB | 0% campione | Attivo; durata N/D | Funzioni locali quando richieste | A | Interrompe web/API/PDF/Eventi | Non arrestare senza verifica d'uso | Riavvio autorizzato del server |
| P2 | Task `Auto-startup all servers` | Avvio automatico su apertura workspace | N/D | N/D | Ogni `folderOpen` | Confermato dall'utente: mantenere l'avvio automatico | A | Funzioni locali non si avviano da sole | Nessuno: comportamento mantenuto | Il task automatico resta configurato |
| P3 | Task e wrapper PowerShell d'avvio | Verifica e avvio del server; wrapper correlati osservati | Circa 225 MB complessivi nello snapshot dei tre PowerShell correlati | 0% campione | Durata N/D | Parte del flusso di startup | A/B | Avvio incompleto o servizio assente | Non terminare durante il funzionamento | Avvio tramite task autorizzato |
| P4 | Timer deploy locale | Sincronizza, calcola fingerprint, pubblica se cambia `public/` | Incluso in Node | N/D per singolo ciclo | Ogni 60 s; ultimo ciclo: deploy saltato | Confermato dall'utente: mantenere il deploy locale automatico | B + E | Se disattivato, modifiche locali non pubblicate automaticamente | Nessuno: mantenere configurazione e comportamento attuali; annotare la discrepanza di versione | Nessun ripristino necessario |
| P5 | Sync Google Bordero | Aggiorna dati da Google Sheets | Incluso in Node | N/D | Ogni 60 s; ultimo ciclo riuscito | Dipende dalla freschezza automatica richiesta | B | Foglio meno aggiornato | Mantenere se richiesto dal flusso operativo | Ripristinare configurazione documentata |
| P6 | Extension Host VS Code | Runtime condiviso delle estensioni | 979 MB | 0% campione | Durante la sessione | Necessario all'editor e alle estensioni | D | Perdita di funzionalita editor | Nessuna disattivazione generalizzata; misurare per estensione | Riattivazione normale |
| P7 | File watcher VS Code | Osservazione modifiche workspace | 136 MB | 0% campione | Durante la sessione | Necessario per aggiornamenti editor | D | Rilevamento modifiche incompleto | Valutare solo esclusioni specifiche e dopo test | Rimuovere l'esclusione |
| P8 | Terminali PowerShell/OpenConsole sotto Code | Shell e pseudo-terminali VS Code | N/D aggregata | N/D | 33 processi per tipo osservati nell'albero Code; durata N/D | Dipende dalle sessioni aperte | D | Perdita di sessioni/comandi; workspace non identificato | Ispezionare i terminali per finestra e chiudere solo quelli confermati inutilizzati | Riaprire il terminale |
| P9 | Estensione Live Server | Server statico alternativo | N/D | N/D | Installata; porta 5503 non in ascolto | Uso corrente non dimostrato | C, previa verifica | Pagine non disponibili sul server Live Server | Disabilitazione temporanea solo dopo conferma di non utilizzo | Riabilitare estensione |
| P10 | Watcher Firebase Cloud Sync | Osserva tre CSV e programma sync locale | Incluso in Node | N/D | Event-driven | Dipende dal flusso Bordero | B/D | Aggiornamento dati ritardato | Nessuna modifica: impatto non misurato | Riavvio server |
| P11 | Task Scheduler/Startup esterno | Avvio pianificato del progetto | N/D | N/D | Nessuna corrispondenza trovata | Non risultano collegamenti diretti | D | N/D | Nessun intervento | N/D |

## 4. Interventi consigliati

1. **Mantenere il deploy locale automatico.** Decisione confermata dall'utente: il timer resta attivo e il file di stato non viene corretto. Il timer esegue sync/hash ogni minuto; GitHub Actions continua a gestire i push a `develop`.
2. **Mantenere l'avvio automatico `folderOpen`.** Decisione confermata dall'utente; il task esistente resta invariato.
3. **Controllare le sessioni terminale in VS Code.** Il conteggio e dell'insieme dei processi sotto Code, non del solo workspace. Chiudere solo terminali verificati come inattivi.
4. **Valutare eventuali esclusioni watcher mirate.** `.venv` contiene 595 file `.pyc`, ma non e stato dimostrato che siano la causa dei 136 MB del watcher. Verificare Python/Pylance prima di escludere la cartella.
5. **Non eliminare dipendenze per ridurre processi.** `node_modules` occupa circa 0,60 GB su disco; questo dato non prova un costo RAM/CPU a riposo.

Diagnostica PowerShell, sola lettura:

```powershell
(Invoke-RestMethod -Uri 'http://127.0.0.1:5500/api/admin/deploy/status' -Method Get).status |
    Select-Object intervalEnabled, sessionAutoEnabled, running, lastRunAt, lastResult
```

Modifica non eseguita, da usare solo dopo autorizzazione esplicita per fermare il timer locale:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:5500/api/admin/deploy/interval' `
    -Method Post -ContentType 'application/json' -Body '{"enabled":false}'
```

Ripristino, se autorizzato:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:5500/api/admin/deploy/interval' `
    -Method Post -ContentType 'application/json' -Body '{"enabled":true}'
```

## 5. Interventi da evitare

- Non terminare indiscriminatamente processi Node, Code.exe o processi associati a una porta. `shutdown.ps1` usa `Stop-Process -Force` su PID e listener 5500.
- Non eseguire `shutdown.ps1` come test: oltre ad arrestare processi può sincronizzare CSV.
- Non usare il task di restart con AutoCommit: puo eseguire `git add .` e commit.
- Non disattivare antivirus, firewall, aggiornamenti o servizi Windows essenziali.
- Non aggiungere esclusioni ampie a `files.watcherExclude`, `search.exclude` o `.gitignore` senza prove e test mirati.
- Non cancellare cache/dipendenze o file Firebase basandosi solo sulla dimensione. I JSON controllati sono gia ignorati da Git.

## 6. Piano di verifica

1. Rilevare RAM/CPU e processi in scenari ripetibili: VS Code senza server, server attivo e navigazione normale.
2. Dopo un'eventuale modifica autorizzata, verificare `/api/health`, `/eventi/api/ping`, listener 5500 e le pagine/funzioni effettivamente usate.
3. Se si disabilita il deploy locale, controllare lo stato `intervalEnabled: false`; verificare separatamente che il workflow GitHub su `develop` resti la via di pubblicazione. Non eseguire deploy senza autorizzazione.
4. Ripetere misure per piu campioni e confrontare finestre/funzioni equivalenti. Una singola lettura CPU non dimostra un miglioramento.
5. Per esclusioni watcher, controllare aggiornamento CSV, diagnostica Python/Pylance e rilevamento Git prima e dopo.

## 7. Risultati misurati

| Misura | Risultato | Nota |
|---|---:|---|
| RAM fisica visibile | 15,78 GB | Snapshot Windows/VS Code |
| RAM libera | 3,4 GB e 2,52 GB in due letture | Istanti diversi; non e un confronto prima/dopo |
| RAM usata riportata | 78,5% nella prima lettura | Istante singolo |
| Disco C: | 475,8 GB totali; 187,9 GB liberi | Snapshot |
| Unified Server | 144 MB; CPU 0% | PID 25436, porta 5500 |
| Extension Host | 979 MB; CPU 0% | Dato `code --status`, processo condiviso |
| File watcher | 136 MB; CPU 0% | Dato `code --status` |
| Window VS Code | 453 MB; CPU 3% | Snapshot |
| GPU process VS Code | 119 MB/1% e 219 MB/2% | Due processi riportati dallo status |
| Terminali sotto Code | 33 PowerShell e 33 OpenConsole | Conteggio dell'albero Code osservato; RAM aggregata N/D |
| `node_modules` | 0,60 GB; 24.528 file | Misura filesystem |
| `.venv` | 0,01 GB; 1.288 file | 595 file `.pyc` nel workspace |
| Timer deploy | Abilitato; `running: false` al controllo | Ultimo risultato: nessuna modifica, deploy saltato |
| Sync Google | Ciclo periodico completato con successo | Cadenza configurata 60 secondi |
| Listener | Porta 5500 attiva; 5501/5502/5503 non in ascolto | Snapshot |
| Task esterni | Nessuna corrispondenza diretta rilevata | Task Scheduler e Startup folder standard |

CPU aggregata di sistema, durata processi, traffico rete, I/O disco, consumo per estensione e confronto prima/dopo: **N/D**. Nessun intervento prestazionale e stato applicato.

## 8. Decisioni richieste all'utente

- Deploy locale automatico ogni minuto: confermato da mantenere cosi com'e; nessuna modifica eseguita.
- Avvio automatico su `folderOpen`: confermato da mantenere; configurazione lasciata invariata.
- Il controllo Task Scheduler/Startup esterno e stato autorizzato ed eseguito; non ha rilevato riferimenti diretti al progetto.
- Nessuna ulteriore autorizzazione richiesta nell'ambito dell'analisi svolta.