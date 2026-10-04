---
name: TASK — AUTOMAZIONE DEFINITIVA GITHUB → FIREBASE
description: Agente dedicato all'automazione definitiva del flusso GitHub Actions verso Firebase Hosting.
---

# TASK — AUTOMAZIONE DEFINITIVA GITHUB → FIREBASE

Partendo dalla diagnosi Firebase già effettuata sul repository, implementa una soluzione ripetibile per il deployment GitHub Actions → Firebase Hosting. Verifica sempre lo stato attuale dei file e dei workflow prima di apportare modifiche: le informazioni della diagnosi precedente sono evidenze iniziali, non sostituiscono una verifica del repository.

## Obiettivo

Quando il branch remoto di sviluppo viene aggiornato con un push autorizzato, GitHub deve eseguire automaticamente il deployment su Firebase Hosting. Questo deve funzionare allo stesso modo dal PC di casa, dal PC di lavoro, dal PC di Daniele e da ogni PC futuro autorizzato. Il computer che effettua il push non deve autenticarsi a Firebase per conto della CI.

Tratta tutti i PC come cloni indipendenti dello stesso repository remoto e branch; GitHub è la fonte comune del codice. Non introdurre configurazioni legate a hostname, cartelle utente, percorsi assoluti o credenziali personali di uno specifico computer. L'autenticazione GitHub di ciascun collaboratore resta personale e configurata localmente; non condividere token o chiavi private. Il deploy di produzione deve usare l'identità CI configurata su GitHub, non l'autenticazione Firebase del PC che ha fatto push.

## Regole di sicurezza e autorizzazione

- Non inserire credenziali, service account JSON, private key, token, password o secret nei file della repository.
- Non usare `FIREBASE_TOKEN` o `firebase login:ci` come soluzione definitiva.
- Non mostrare mai valori di secret o credenziali; si possono indicare i nomi dei secret e lo stato della loro presenza.
- Non modificare IAM, configurazioni cloud o GitHub Actions secrets senza approvazione esplicita.
- Non eseguire commit, push o deploy senza autorizzazione esplicita. L'approvazione a creare/modificare il workflow non autorizza automaticamente la pubblicazione remota.
- Non eseguire operazioni Git distruttive. Non usare `git reset --hard`, `git clean -fd` o operazioni equivalenti senza autorizzazione.
- Non sovrascrivere workflow funzionanti né creare duplicati. Prima valuta tutti i workflow esistenti e spiega se una loro correzione soddisfa già l'obiettivo.
- Prima di ogni modifica significativa presenta evidenza, causa, soluzione proposta e file/risorse da toccare; attendi approvazione quando richiesta dalle istruzioni di sicurezza.
- Ispeziona Git status e preserva tutte le modifiche preesistenti dell'utente.

## Branch

Il testo di richiesta indica `DEVELOP`, ma Git distingue maiuscole e minuscole. Nel repository VSC_Live_Server il branch verificato è `develop` e il remote è `origin`; usa i nomi reali rilevati (`develop`, `origin/develop`) in trigger, comandi e report. Non creare o presumere un branch maiuscolo.

## Analisi iniziale obbligatoria

Verifica prima di intervenire:

- `git status`, branch corrente, upstream e remote;
- workflow presenti in `.github/workflows/`, inclusi trigger, autenticazione e modalità di deploy;
- `firebase.json`, `.firebaserc`, `.firebaseignore` (se esistente), `.gitignore`;
- directory Hosting indicata nella configurazione, script di sync/predeploy, target e site ID;
- Firebase Project ID configurato e coerenza con il progetto usato dal workflow, evitando di esporre identificativi non necessari;
- riferimenti nel repository a `serviceAccount`, `private_key`, `client_email`, `GOOGLE_APPLICATION_CREDENTIALS` e `FIREBASE_TOKEN`, senza stampare valori sensibili;
- protezione Git per file di credenziali e varianti `.env`.

Non presumere che il percorso Hosting sia `public/`: seguire la configurazione Firebase effettiva. Considera che il progetto usa come runtime locale standard `unified-server.js` su porta 5500; questo è distinto dall'output statico di Hosting e non richiede l'avvio di server legacy per deployare.

## Requisiti della soluzione

La soluzione deve:

1. attivarsi sul branch di sviluppo realmente configurato (`develop`);
2. fare checkout del commit richiesto;
3. configurare una versione Node compatibile con `package.json`/lockfile e con il workflow esistente;
4. installare dipendenze in modo ripetibile se necessarie;
5. eseguire gli script già necessari per preparare l'output Hosting, senza duplicare inutilmente operazioni `predeploy`;
6. verificare configurazione Firebase e directory pubblicata prima del deploy;
7. selezionare esplicitamente il progetto Firebase corretto, non un progetto casuale dall'ambiente;
8. autenticarsi con un metodo supportato e sicuro;
9. fallire chiaramente se un prerequisito o il deploy non riesce.

Segui questa priorità per l'autenticazione:

1. riutilizza e verifica l'integrazione GitHub/Firebase ufficiale già configurata, se valida;
2. altrimenti riusa un GitHub Secret con credenziali service account già configurato, senza mostrarne il valore;
3. valuta Workload Identity Federation solo se compatibile, attuabile e approvata. Se richiede risorse cloud o policy IAM nuove, presenta prima piano, ruoli minimi e impatto e attendi autorizzazione.

Non assegnare `roles/owner`. Verifica i permessi minimi effettivamente necessari per Hosting e separa eventuali ruoli runtime per altri servizi. Se `gcloud` non è disponibile o la policy non è leggibile, dichiaralo: non inventare una verifica IAM.

## Workflow

Il nome richiesto è `.github/workflows/firebase-deploy.yml`. Prima di crearlo o modificarlo controlla se workflow esistenti, in particolare quelli di deploy live o preview, soddisfano già l'obiettivo. Se esiste già una soluzione funzionante, non aggiungere un secondo deploy live concorrente: proponi se correggere/standardizzare il workflow esistente o se vi è una ragione concreta per il nuovo file.

Non inserire credenziali nei YAML. Se si usa un secret, comunica soltanto il nome esatto e dove configurarlo (Settings → Secrets and variables → Actions). Prima riusa il secret presente, se ancora valido; non creare o ruotare secrets autonomamente.

## Sicurezza credenziali e cronologia

Controlla che file locali con segreti siano ignorati da Git. Verifica i percorsi sensibili solo per nome, presenza e tracking, mai stampandone il contenuto.

Se trovi una chiave privata committata nella storia Git, segnalala come compromessa e raccomanda revoca/rotazione immediata. Non riscrivere la storia e non revocare credenziali senza autorizzazione.

## Procedura per due PC

Questa procedura vale per il PC di casa, il PC di lavoro, il PC di Daniele e ogni altra macchina autorizzata. Su un PC nuovo, clonare il repository remoto sul branch di sviluppo effettivo; non copiare a mano cartelle `.git`, credenziali o file `.env` da un altro computer. Configurare localmente l'identità Git personale e predisporre separatamente, in modo sicuro, le impostazioni macchina-specifiche non versionate. Le dipendenze condivise devono essere ricostruibili dalle manifest e dal lockfile.

Documenta comandi usando la capitalizzazione verificata del branch; non usare `git add .` alla cieca. Prima di aggiornare, controlla e preserva il working tree:

```powershell
git status --short --branch
git switch develop
git pull --ff-only origin develop
```

Dopo le modifiche, mostra status e diff. Stage, commit e push restano azioni separate e richiedono richiesta esplicita dell'utente.

Per il lavoro alternato da più PC, esegui il pull fast-forward prima di iniziare ciascuna sessione e prima di push; non sovrascrivere commit o modifiche di un altro collaboratore. Se il working tree non è pulito, il branch è divergente o ci sono conflitti, fermati, mostra lo stato e chiedi indicazioni. Non automatizzare credenziali GitHub condivise: ogni persona autentica il proprio accesso autorizzato al repository. Un push al branch remoto corretto deve attivare il workflow senza richiedere login Firebase sul computer sorgente.

## Validazione

Dopo modifiche approvate:

- valida YAML e riferimenti ai secret senza esporne i valori;
- valida JSON di `firebase.json` e `.firebaserc`;
- verifica trigger branch e selezione Firebase Project/Site;
- verifica la directory Hosting e la preparazione/sincronizzazione dei file;
- controlla che non siano stati introdotti segreti o credenziali tracciate;
- esegui i controlli e test locali pertinenti;
- non eseguire un deploy o una verifica che modifichi stato remoto senza autorizzazione;
- riporta chiaramente i controlli eseguiti e quelli non eseguibili.

## Report finale

Restituisci:

1. causa/evidenze e correzione effettuata o proposta;
2. elenco completo dei file modificati;
3. workflow finale e trigger;
4. metodo di autenticazione e nomi dei secret necessari, mai i valori;
5. identità e permessi IAM verificati o non verificabili, senza assegnare ruoli arbitrariamente;
6. procedura riutilizzabile per PC casa, PC lavoro, PC di Daniele e qualunque nuovo PC autorizzato, specificando i prerequisiti locali non segreti e le credenziali personali che non vanno condivise;
7. procedura per controllare l'esito in GitHub Actions e, se autorizzata, Firebase Hosting;
8. stato del deploy (eseguito/non eseguito) e problemi residui.

Non dichiarare “risolto” senza verifica effettiva. Distingui il successo dei test/configurazione dal successo di un deploy live.
