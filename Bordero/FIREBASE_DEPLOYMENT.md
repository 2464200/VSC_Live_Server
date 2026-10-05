# Accesso Google e deploy Firebase

Questa guida documenta l'accesso degli account publisher Borderò, la sincronizzazione Realtime Database e la pubblicazione del sito su Firebase Hosting.

## Account Google autorizzati

Le regole in `database.rules.json` consentono la scrittura al percorso `bordero/display_state` solo ai due utenti autenticati con e-mail verificata:

- `lucafaby@gmail.com`
- `djdaniele1984@gmail.com`

La stessa allowlist è applicata dal client Borderò prima di mostrare l'azione di pubblicazione; l'autorizzazione effettiva di scrittura è sempre verificata dalle regole Realtime Database. Il selettore Google può mostrare altri account configurati nel browser, ma solo questi due indirizzi verificati sono autorizzati a pubblicare.

## Dove accedere

L'accesso e il pulsante di pubblicazione manuale si trovano in **Admin → Google Account**. La pagina Borderò non mostra controlli di accesso o cambio account; mantiene comunque la sincronizzazione automatica usando la sessione Firebase autenticata.

Usare il runtime standard locale:

1. Avviare `unified-server.js` dalla root del repository.
2. Aprire `http://localhost:5500/Bordero/pages/admin.html`.
3. In **Google Account**, premere **Accedi con Google** e scegliere il profilo autorizzato.
4. Se un account è già connesso, il pulsante consente di cambiare account. Google mostra la schermata di selezione e richiede l'autenticazione dell'account scelto.
5. Per inviare immediatamente lo stato locale, premere **Pubblica stato locale**. Dopo l'accesso, le modifiche a serata e NEXT continuano a sincronizzarsi automaticamente.

Per l'uso completo dell'applicazione locale, avviare il runtime standard su `localhost:5500`; un'anteprima statica può non esporre tutte le API applicative richieste dal progetto.

## Browser ed Electron

- **Browser ed Electron:** entrambi usano Firebase Authentication con Google Sign-In, `prompt=select_account` e l'identità restituita direttamente dal provider. In Electron il popup Google è gestito da `electron/google-auth-popup.js` e dalle policy delle finestre in `electron/main.js`.
- Ogni utente sceglie e autentica il proprio account Google; l'e-mail e la password, quando Google le richiede, sono verificate da Google. Se Google riconosce già una sessione, può completare il login senza chiedere nuovamente la password. L'app non riceve né memorizza la password.
- Scegliere o scrivere un'e-mail in un elenco non autentica l'utente. Il vecchio endpoint locale che emetteva un custom token sulla sola base dell'e-mail selezionata è stato rimosso.
- L'autenticazione publisher non richiede un account di servizio Firebase locale. Il secret account di servizio GitHub Actions menzionato sotto è usato esclusivamente per il deploy Hosting.
- Dopo il login, la sessione Firebase è condivisa dalle pagine della stessa origine; Admin ospita i comandi di accesso e pubblicazione, mentre Borderò continua a sincronizzare lo stato.

## Autenticazione Firebase e regole RTDB

Configurazione del provider Google e domini autorizzati: `firebase.json`.

- Domini configurati: `localhost`, `my-project-1525790600392.firebaseapp.com`, `my-project-1525790600392.web.app`.
- Regole di lettura/scrittura: `database.rules.json`.
- Il display su Firebase Hosting legge lo stato in sola lettura e non richiede login.
- Il secret account di servizio GitHub Actions è una credenziale privata per il deploy e non sostituisce le regole RTDB; non copiarlo in `public/` né inserirlo nel repository.

Se cambiano provider Google, domini autorizzati o regole RTDB, distribuire esplicitamente tali configurazioni da un ambiente Firebase CLI autenticato. In particolare, dopo la rimozione di un account autorizzato, il deploy delle regole è necessario perché il cambiamento abbia effetto anche sul database remoto:

```powershell
npm exec -- firebase deploy --only auth,database --project my-project-1525790600392
```

Il deploy del solo Hosting non applica queste configurazioni.

## Deploy Firebase Hosting

Il contenuto pubblicato è `public/`. L'hook `predeploy` in `firebase.json` esegue `npm run sync:public` per sincronizzare le pagine Borderò e gli asset prima del deploy.

### Deploy automatico (preferito)

Un push sul branch `develop` avvia `.github/workflows/firebase-hosting-merge.yml` e pubblica il canale live Hosting per il progetto `my-project-1525790600392`. La repository GitHub deve avere configurato il secret `FIREBASE_SERVICE_ACCOUNT_MY_PROJECT_1525790600392`, usato esclusivamente da GitHub Actions per il deploy. La workflow esegue un preflight read-only che verifica branch, progetto, output Hosting e configurazione. Le Pull Request dello stesso repository pubblicano invece un canale preview tramite `.github/workflows/firebase-hosting-pull-request.yml`.

Per il flusso ordinario, integrare e testare le modifiche su `develop`; non serve avviare un deploy locale. Nota: questo workflow pubblica Hosting direttamente da `develop`, indipendentemente dalla successiva promozione Git `develop` → `main`.

### Deploy manuale

Solo quando esplicitamente necessario e da una CLI Firebase autorizzata:

```powershell
npm run deploy:firebase
```

Lo script distribuisce Hosting e avvia la sincronizzazione `public/` configurata come predeploy. Il deploy manuale non distribuisce `auth` o `database`.

## Prestazioni e cache

- La configurazione web Firebase viene conservata in `sessionStorage` per un massimo di un'ora per ridurre le richieste ripetute durante la sessione della scheda.
- Le pagine e gli script usano versioni query-string per invalidare le cache quando cambiano gli asset. Aggiornare la versione del client Firebase nei relativi HTML quando si modifica il comportamento di autenticazione.
