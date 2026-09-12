# Regole di ordinamento e priorità BORDERÒ

## Obiettivo

Questa pagina raccoglie in un unico punto le regole operative che governano:
- la selezione NEXT coreo
- il flag X di esecuzione
- lo spostamento dei brani in fondo
- l’ordinamento tra righe con lo stesso titolo

## 1) Regola NEXT coreo

La selezione NEXT è una scelta unica e distinta dal flag di esecuzione.

- Un solo brano può essere selezionato come NEXT alla volta.
- Il brano in NEXT deve essere portato sempre in cima/all’inizio della lista.
- Dopo la selezione, la pagina deve tornare alla prima pagina.
- La scelta deve resistere a refresh, sort, filtri, paginazione e auto-refresh.
- La scelta deve essere persistente nello storage e sincronizzata con display/overlay.
- Un brano già eseguito (flag X) non può essere selezionato come NEXT.
- La selezione NEXT deve essere rimossa solo in modo esplicito: deselezione o completamento del brano.
- Nessun altro pulsante o refresh della tabella può cancellare la selezione NEXT.

## 2) Regola esecuzione (flag X)

Quando un brano viene eseguito:

1. Il brano eseguito ottiene il flag X e viene posizionato in fondo alla lista.
2. Tutti i brani che hanno lo stesso titolo nella colonna Titolo/Coreografia devono essere portati in fondo insieme a quello eseguito.
3. La regola si applica anche ai brani con titolo identico già presenti in elenco: vengono riordinati in fondo alla stessa occasione, indipendentemente dal loro stato precedente.
4. Le righe omonime spostate in fondo non ricevono il flag X; mantengono lo stato originario ma vengono messe in fondo per non duplicare le chiamate in cima.
5. L’ordine di fondo deve seguire l’ordine ID.
6. Tra le righe omonime, solo la riga effettivamente eseguita deve essere riconosciuta come X.
7. Se il sistema viene riavviato o la pagina viene ricaricata, la regola deve essere riattivata automaticamente: titolo uguale a quello eseguito continua a restare in fondo e solo la riga X resta marcata come eseguita.

## 3) Regola generazione file SIAE

L’esportazione SIAE è un’operazione separata dalla scelta NEXT e deve partire solo dai brani realmente eseguiti.

- Il file SIAE viene generato solo a partire dai brani con flag X.
- Nessun brano in NEXT o non eseguito deve comparire nel file SIAE.
- L’export deve usare il set di colonne standard: Titolo, Autore, Compositore, Performer, Durata.
- Il file viene scritto nel percorso di riferimento C:\VSC_SIAE.
- In ambiente Electron il download deve essere forzato verso la stessa cartella di output server-side; non deve finire in cartelle di download del browser.
- La generazione avviene per serata: un solo file per l’insieme dei brani eseguiti della serata corrente.
- Se un brano è stato marcato come eseguito, il file SIAE deve riflettere quel completamento senza confondere lo stato di NEXT.

## 4) Distinzione tra stati

- NEXT = prossima coreografia scelta
- X = brano eseguito
- SIAE = export finale dei brani eseguiti della serata

Questi stati non vanno confusi: NEXT è una priorità di scelta, X è uno stato di completamento, SIAE è un file di output derivato dal set di brani eseguiti.

## 5) Checklist operativa

### Selezione NEXT
- [ ] Un solo brano può essere selezionato come NEXT.
- [ ] Il brano NEXT resta sempre sopra tutte le altre righe.
- [ ] La pagina torna a 1 dopo la selezione.
- [ ] La scelta non viene persa a causa di refresh o altri controlli UI.
- [ ] Il display/overlay mostra lo stesso titolo selezionato.

### Esecuzione
- [ ] Quando un brano viene spuntato come eseguito, scende in fondo all’elenco.
- [ ] Tutte le righe con lo stesso titolo vanno in fondo insieme a quella eseguita.
- [ ] L’ordine di fondo segue l’ordine ID.
- [ ] Eventuali brani con lo stesso titolo scendono insieme in fondo.
- [ ] Solo una riga diventa X; le altre simili restano in fondo senza X.
- [ ] Se la pagina viene riavviata, la regola viene riattivata e mantiene il titolo eseguito in fondo con le sue simili.
- [ ] La selezione NEXT viene rimossa quando il brano viene completato.

### Export SIAE
- [ ] Il file SIAE include solo brani con flag X.
- [ ] Nessun brano in NEXT o non eseguito compare nel file SIAE.
- [ ] Il file viene scritto in C:\VSC_SIAE.
- [ ] Le colonne usate sono quelle standard di SIAE.
- [ ] Il file è generato per la serata corrente e non per la lista completa.

## 6) Regola di sintesi

NEXT = scelta corrente, sopra tutte le altre righe.
X = conoscenza di esecuzione, in fondo all’elenco con le simili.
Titolo uguale a quello eseguito = sempre spostato in fondo insieme ad esso, anche dopo riavvio o ricarica.
SIAE = output finale dei brani eseguiti della serata.

Questa regola va mantenuta come riferimento operativo per tutte le modifiche future.
