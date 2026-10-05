# Accesso Google e deploy Firebase

Questa guida documenta l'accesso degli account publisher Borderò, la sincronizzazione Realtime Database e la pubblicazione del sito su Firebase Hosting.

## Account Google autorizzati

Le regole in `database.rules.json` consentono la scrittura al percorso `bordero/display_state` solo a utenti autenticati con e-mail verificata e appartenenti a questa lista:

- `lucafaby@gmail.com`
- `djdaniele1984@gmail.com`
- `azzurriditalia@yahoo.it`

La stessa allowlist è applicata al client Borderò e all'endpoint locale che crea custom token. L'account `azzurriditalia@yahoo.it` è autorizzato alle regole Firebase ma non è offerto dal selettore Electron, che espone intenzionalmente solo i due profili Luca e Daniele.

## Dove accedere

L'accesso e il pulsante di pubblicazione manuale si trovano in **Admin → Google Account**. La pagina Borderò non mostra controlli di accesso o cambio account; mantiene comunque la sincronizzazione automatica usando la sessione Firebase autenticata.

Usare il runtime standard locale:

1. Avviare `unified-server.js` dalla root del repository.
2. Aprire `http://localhost:5500/Bordero/pages/admin.html`.
3. In **Google Account**, premere **Accedi con Google** e scegliere il profilo autorizzato.
4. Se un account è già connesso, il pulsante consente di cambiare account. La sessione Firebase è condivisa dalle pagine della stessa origine.
5. Per inviare immediatamente lo stato locale, premere **Pubblica stato locale**. Dopo l'accesso, le modifiche a serata e NEXT continuano a sincronizzarsi automaticamente.

Il runtime standard deve essere aperto tramite `localhost:5500`: server di anteprima statici o host/porte differenti possono non avere l'endpoint locale necessario.

## Browser ed Electron

- **Browser:** Firebase Authentication apre il popup Google con `prompt=select_account`, così è possibile scegliere o cambiare profilo. L'identità viene verificata dal provider Google/Firebase.
- **Electron:** il flusso OAuth popup non è usato. L'interfaccia propone `lucafaby@gmail.com` e `djdaniele1984@gmail.com`; il server locale crea un Firebase custom token per l'utente corrispondente. L'endpoint `/api/firebase-publisher-token` accetta solo richieste loopback e rifiuta indirizzi e-mail fuori allowlist.
- Per il flusso Electron serve un account di servizio Firebase disponibile solo sul PC/server, tramite `FIREBASE_SERVICE_ACCOUNT_PATH`, `.firebase/service-account.json` o `firebase/service-account.json`. Non committare né pubblicare questa chiave e non copiarla nella cartella `public/`. Il normale accesso browser non richiede questa chiave.
- Il selettore Electron assegna il token all'utente Firebase corrispondente all'e-mail selezionata; non effettua un secondo popup OAuth Google nel runtime Electron.

## Autenticazione Firebase e regole RTDB

Configurazione del provider Google e domini autorizzati: `firebase.json`.

- Domini configurati: `localhost`, `my-project-1525790600392.firebaseapp.com`, `my-project-1525790600392.web.app`.
- Regole di lettura/scrittura: `database.rules.json`.
- Il display su Firebase Hosting legge lo stato in sola lettura e non richiede login.
- La chiave account di servizio è una credenziale privata server-side e non sostituisce le regole RTDB.

Se cambiano provider Google, domini autorizzati o regole RTDB, distribuire esplicitamente tali configurazioni da un ambiente Firebase CLI autenticato:

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
- Il token publisher usa `Cache-Control: no-store`; non deve essere salvato o riutilizzato come cache applicativa.
- Le pagine e gli script usano versioni query-string per invalidare le cache quando cambiano gli asset. Aggiornare la versione del client Firebase nei relativi HTML quando si modifica il comportamento di autenticazione.
