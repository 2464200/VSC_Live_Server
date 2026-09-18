# Roadmap di integrazione `develop` / `daniele-local`

## 1. Regola guida

`develop` e' il branch dominante e rimane la base di riferimento. Le modifiche di
`daniele-local` vengono integrate solo quando il loro comportamento e' compatibile
con l'architettura corrente, la portabilita' e il server unificato su porta `5500`.

Non si eseguira' un merge cieco dell'intero branch `daniele-local`: ogni area sara'
analizzata, portata in una singola unita' funzionale e verificata separatamente.

## 2. Baseline iniziale

Stato rilevato al momento della creazione della roadmap:

| Riferimento | Commit | Ruolo |
|---|---|---|
| `develop` | `04c10e2` | Branch dominante e base di integrazione |
| `daniele-local` | `46a8c0a` | Sorgente delle modifiche candidate |
| Divergenza | `96` commit solo in `develop`, `45` solo in `daniele-local` | Da riesaminare prima di ogni fase |

### Esito baseline fase 0

- `npm run test:system`: superato, 30 controlli su server, API, pagine e CSV.
- `npm run test:bordero`: superato, ordinamento degli eseguiti verificato.
- `verify_project.ps1`: warning preesistente per `pdf-server.js`, riferimento legacy non
   coerente con l'architettura corrente basata su `unified-server.js`; da trattare nella
   fase 7/8, non da correggere durante questa baseline.

### Manifesto iniziale dei candidati

| Area | Superficie candidata | Decisione iniziale |
|---|---|---|
| Dati | `Bordero/data/*`, `public/Bordero/data/*`, `NextCoreo.csv` | Confronto semantico e sincronizzazione controllata; nessuna sovrascrittura globale |
| Navigazione | `Bordero/index.html`, `Bordero/pages/*.html`, `Bordero/js/home-nav-guard.js` | Valutare link Home e compatibilita' Electron |
| Display | `Bordero/pages/display.*`, `public/index*.html`, `public/NextCoreo1.html` | Analizzare overlay, prossima coreografia, storage e fallback |
| Mobile | `public/mobile.html`, `public/mobile-script.js`, `public/mobile-style.css` | Verificare il nuovo layout senza perdere scroll, fullscreen e refresh |
| SERVIZIO | `USERFORM/pages/SERVIZIO*.html`, `public/servizio.html` | Valutare testo, logo, file locali e carrellate come capability separate |
| Bordero | `Bordero/pages/bordero*.html`, admin, richieste, videoclip | Integrare ordinamento e UX solo dopo il contratto dati |
| Server/Electron | `unified-server.js`, `electron/*`, sync Google Sheets | Verificare prima porte, API, sicurezza e fallback |
| Operativita' | task, script Git, documentazione e copie `public/` | Integrare solo dopo le aree funzionali |

Prima di ogni fase si devono rieseguire:

```powershell
git fetch origin --prune
git rev-list --left-right --count develop...daniele-local
git status --short --branch
```

La working tree deve essere pulita. Eventuali modifiche locali devono essere
messe in stash o committate esplicitamente prima di iniziare la fase.

## 3. Metodo di integrazione

Per ogni area:

1. Creare un branch temporaneo dalla punta di `develop`, ad esempio
   `integration/daniele-display`.
2. Selezionare commit o modifiche funzionali pertinenti da `daniele-local`.
3. Preferire porting mirato o `cherry-pick` di commit omogenei; usare un merge
   completo solo quando la storia e' coerente e non trascina modifiche estranee.
4. Risolvere i conflitti mantenendo contratti, percorsi e configurazione di
   `develop` come riferimento.
5. Eseguire la verifica tecnica e manuale prevista dalla fase.
6. Fermarsi e richiedere la revisione obbligatoria dell'utente.
7. Solo dopo approvazione esplicita dell'utente, integrare il branch temporaneo
   in `develop` con un commit di merge identificabile.
8. Ripetere tutti i controlli post-merge e attendere una nuova revisione utente.

Un merge tecnicamente riuscito non autorizza automaticamente la fase successiva.
Ogni fase ha un gate umano obbligatorio.

## 4. Fasi per area

| Fase | Area | Cosa analizzare in `daniele-local` | Strategia candidata | Priorita' |
|---|---|---|---|---|
| 0 | Baseline e contratti | Hash, divergenza, CSV duplicati, porte, script caricati e dipendenze | Nessun merge; congelare baseline e test di riferimento | Bloccante |
| 1 | Dati Bordero | `brani.csv`, `Accoda 8+12.csv`, indici e copie `public/`; categorie, ordinamento, omonimi, eseguiti | Porting dati riga per riga; mai sovrascrivere CSV senza confronto semantico | Alta |
| 2 | Navigazione e Home | `Bordero/index.html`, link Home, `home-nav-guard.js`, pagine collegate | Integrare solo protezioni e link compatibili con i percorsi di `develop` | Alta |
| 3 | Display PC e prossima coreografia | `Bordero/pages/display.html`, `display.js/css`, overlay logo, annuncio Next Coreo, stato vuoto | Unificare il contratto dati; mantenere il fallback previsto da `develop` | Alta |
| 4 | Display pubblici e mobile | `public/index*.html`, `public/mobile.html`, `mobile-script.js`, `NextCoreo1.html` | Validare sincronizzazione `localStorage`, CSV e cache; mantenere compatibilita' desktop/mobile | Alta |
| 5 | SERVIZIO multimediale | `USERFORM/pages/SERVIZIO*.html`, immagini, logo e carrellate | Integrare per capability: testo, logo, file locali, slideshow; verificare limiti e fallback | Media-alta |
| 6 | Bordero applicativo | `bordero.html`, `admin.html`, `lista-serata.html`, richieste, eseguiti e video | Portare ordinamento e UX solo dopo aver stabilizzato il contratto dati | Alta |
| 7 | Electron e server | `electron/main.js`, preload, API immagini, Google Sheets sync, unified server | Integrare solo se compatibile con `unified-server.js:5500`; nessun ritorno alle porte legacy | Bloccante |
| 8 | Documentazione e pulizia | Script di protezione, task, file pubblici duplicati e riferimenti obsoleti | Rimuovere duplicati solo dopo test e approvazione; aggiornare guide | Media |

## 5. Gate di verifica obbligatori

### Prima del merge

- `git diff --check`
- confronto dei file coinvolti con `develop`
- verifica che non siano entrati file o commit estranei all'area
- controllo di sintassi JavaScript e JSON dove applicabile
- verifica dei percorsi HTML e degli script referenziati

### Dopo il merge

Eseguire almeno:

```powershell
npm run test:system
npm run test:bordero
pwsh -File .\verify_project.ps1
```

Quando la fase tocca pagine o flussi visuali, verificare anche manualmente:

- homepage e navigazione Home;
- Bordero, Display PC e Display mobile;
- selezione e visualizzazione della prossima coreografia;
- SERVIZIO testuale, logo e carrellata quando inclusi;
- fullscreen, refresh, sincronizzazione e fallback offline;
- API del server unificato su `http://localhost:5500`.

Se un controllo fallisce, la fase viene riaperta e il merge non viene considerato
completato. Non si passa all'area successiva per compensare un test rosso.

## 6. Revisione utente obbligatoria

Al termine di ogni merge verra' prodotto un report con:

- commit integrato e file interessati;
- comportamento aggiunto o modificato;
- output dei test automatici;
- controlli manuali eseguiti e loro risultato;
- rischi residui e piano di rollback.

Il lavoro si fermera' in modo esplicito con lo stato **IN ATTESA DI REVISIONE
UTENTE**. La fase sara' chiusa solo dopo una conferma esplicita dell'utente.
Senza conferma, non verranno eseguiti altri merge, push o fasi successive.

## 7. Rollback e tracciabilita'

Prima di ogni integrazione creare un tag o annotare il commit di `develop`, per
esempio `pre-merge-daniele-<area>-<data>`. In caso di regressione:

1. fermare la fase;
2. conservare log e risultati dei test;
3. ripristinare il branch temporaneo al checkpoint;
4. non riscrivere la storia pubblicata di `develop` senza autorizzazione;
5. riportare all'utente causa, impatto e proposta correttiva.

## 8. Ordine operativo concordato

L'ordine consigliato e': **0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8**.

La fase 1 viene prima dell'interfaccia per evitare che differenze nei CSV rendano
inaffidabili i test Display e Bordero. La fase 7 rimane verso la fine perche'
tocca server, Electron e sincronizzazioni con il rischio piu' alto.

La prossima azione e' la fase 0: congelare la baseline, produrre il manifesto dei
file/commit candidati e sottoporlo alla revisione dell'utente prima del primo
merge.

## 9. Esito analisi fase 1: dati Bordero

Per i file qui sotto e' stato usato il confronto diretto tra le punte:
`git diff develop daniele-local`. Il confronto con `...` mostra invece il
percorso dal merge-base e non e' sufficiente, da solo, per descrivere la
differenza finale tra i due branch.

| File/insieme | Differenza osservata | Decisione |
|---|---|---|
| `Bordero/data/brani.csv` | 97 righe cambiate: livelli, flag richieste e alcune descrizioni/classificazioni | Candidato funzionale, ma da portare con controllo per ID e copia pubblica coerente |
| `Bordero/data/Accoda 8+12.csv` | Aggiornamento del contenuto operativo della serata | Candidato separato; verificare che non sia stato incluso per errore come stato temporaneo |
| `Bordero/data/deejay.csv` | Cambia intestazioni/nominativi e rimuove `BUMBY` | Non automatico: richiede conferma dei nomi visualizzati e dei consumatori |
| `Bordero/data/location.csv` | Una voce viene rimossa | Non automatico: possibile perdita di una sede/evento |
| `Bordero/data/get-camera-name.csv` | Profili webcam e stato FFmpeg specifici di una macchina | Escluso dal merge dati; da gestire nella fase Electron/configurazione |
| `Bordero/data/music-archive-config.json` | Percorso locale cambia da libreria utente a `C:\VSC_MP3` | Escluso dal merge dati; valutare solo tramite configurazione portabile |
| `Bordero/data/music-archive-index.csv` | Nuovo indice con percorso locale e scansione diversa | Escluso dal merge dati; richiede verifica server e ambiente |
| `NextCoreo.csv` e copie `public/` | Cambia la prossima coreografia visualizzata | Stato operativo, non codice: non portare nel branch senza una decisione sulla serata |
| `public/Bordero/data/*` | Copie pubbliche aggiornate insieme a parti del nuovo flusso display | Da integrare solo insieme al codice che le consuma, nella fase Display/Mobile |
| `public/serata_meta.json` | Aggiunge metadati DJ/data/luogo/evento | Da integrare solo con il nuovo display mobile e relativo fallback |

### Stop della fase 1

Non viene eseguito un merge dati parziale finche' non e' approvata la scelta
semantica sulle righe di `brani.csv`, `Accoda 8+12.csv`, `deejay.csv` e
`location.csv`. Portare file macchina-specifici o stato della serata in
`develop` introdurrebbe regressioni non riproducibili.

Il primo merge proposto sara' quindi un porting tracciato dei soli dati
approvati, con confronto per ID, controllo delle copie `public/` e riesecuzione
di `npm run test:system` e `npm run test:bordero`. Dopo quel merge il processo
si fermera' nuovamente in attesa della revisione utente.