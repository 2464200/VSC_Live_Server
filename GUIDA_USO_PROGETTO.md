# Guida d'uso del progetto VSC Live Server

> 📌 Questa documentazione fa parte della [guida unificata del progetto](README.md).


## Panoramica
Questo progetto usa il server unificato `unified-server.js` sulla porta standard `5500`. Tutte le pagine principali del progetto e le API condivise sono servite da questo server.

Per setup portabili o avvio automatico, i metodi supportati sono:
- `START-UNATTENDED.bat`
- `npm run start:portable`
- `node unified-server.js`

VS Code Live Server può essere usato solo facoltativamente per anteprime statiche; non fa parte del runtime del progetto e non deve essere avviato insieme al server unificato.

Il task VS Code `Auto-startup and supervise project` non mostra finestre di conferma durante il monitoraggio. Se Electron viene chiuso, il supervisore lascia chiusa l'interfaccia, mantiene attivi e controllati i servizi del progetto e consente di riaprire Electron manualmente; la normale chiusura del progetto tramite `shutdown.ps1` arresta anche il supervisore.

## Regole correnti per Electron e il monitor secondario

Quando Electron è in esecuzione:

- `Bordero/pages/display.html` è la pagina persistente prevista sul monitor 2.
- Una nuova navigazione a una pagina dell'app chiude le pagine HTML temporanee precedenti e il player VideoClip, quindi apre la nuova pagina secondo la policy di monitor. Non devono accumularsi overlay secondari.
- DISPLAY rimane sotto la pagina secondaria attiva. Le pagine primarie (ad esempio Borderò, Eventi e USERFORM) non la sostituiscono.
- `CHIUDI DISPLAY` in Borderò è un'eccezione manuale: richiede il codice segreto configurato e chiude la finestra persistente. La navigazione ordinaria non riapre DISPLAY dopo questa chiusura; aprire esplicitamente la pagina DISPLAY per ripristinarla.
- Popup Google OAuth e siti esterni non sono pagine HTML dell'app e seguono il proprio flusso.

Se una modifica di routing non sembra attiva, chiudi e riavvia Electron. I test automatizzati controllano le policy, ma la disposizione finale va provata anche sul notebook con entrambi i monitor collegati.

## Operazioni Borderò e VideoClip

- In `Bordero/pages/videoclip.html`, PLAY avvia il video sul monitor 2; PAUSA mette in pausa e al click successivo riprende lo stesso video dal punto corrente. Il pulsante lampeggia soltanto durante la pausa.
- `FERMA VIDEO` in Borderò ferma il player secondario. La navigazione a una nuova pagina chiude quel player per evitare che resti davanti o dietro alla pagina appena aperta.
- `CHIUDI DISPLAY` chiede il codice segreto prima di chiudere la pagina persistente.
- La diagnostica VideoClip si attiva dal relativo controllo in `videoclip.html`; i valori di buffering/frame sono quelli esposti dal player e non misurano temperatura, utilizzo GPU o prestazioni complessive del PC.

## SERVIZIO e REGISTRO COREOGRAFIE

- In SERVIZIO, inserisci il messaggio, scegli eventualmente font e dimensione massima a destra di `Pubblica testo`, poi pubblicalo. `Segoe UI` è il font predefinito; `Auto` lascia al sistema la scelta della dimensione massima che entra nell'area. Se si imposta una dimensione, è un limite massimo e il testo può ridursi per rientrare.
- Il font scelto deve essere installato sul computer che visualizza il messaggio sul monitor secondario; altrimenti il browser usa il fallback.
- REGISTRO COREOGRAFIE apre sia il progetto sia la base dati in una nuova scheda del browser predefinito. Il progetto non usa una finestra Electron fullscreen.

## Operazioni Eventi

- Per aprire Borderò da Eventi, usare `Borderò single DJ` e confermare la password richiesta.
- La richiesta è una protezione dell'interfaccia client: non sostituisce autorizzazione server-side e non impedisce l'accesso diretto all'URL Borderò.

## Verifiche mirate delle funzionalità recenti

```powershell
node --test test/electron-display-manager.test.js test/navigation-window-routing.test.js test/scriptpdf-workbench.test.js test/userform-servizio.test.js
```

Il test automatizzato non sostituisce la verifica dal vivo: apri più pagine secondarie in sequenza e controlla che resti una sola pagina temporanea e che DISPLAY rimanga in background, a meno che sia stata chiusa dall'utente.

## Server e porte

### Schema delle porte attive

- `5500` → `unified-server.js`
  - serve file statici dalla root del progetto
  - serve il modulo Eventi su `/eventi`
  - serve API Eventi su `/eventi/api`
  - è il runtime standard del progetto
- `5503` → Live Server / anteprima editor
  - usato solo per preview statiche in VS Code
  - non è il runtime del progetto
- `5512` → controllo Electron
  - usata da `electron/main.js` per i comandi di controllo del launcher Electron
- `4212` → controllo remoto VLC
  - usata da `unified-server.js` per i comandi di controllo VLC sul monitor secondario

### Porte legacy / storiche

- `3000`, `3010`, `8765` sono riferimenti storici del vecchio setup multi-server
- il flusso attuale standard è sempre `unified-server.js` su `5500`

## Come avviare il progetto reale

1. Apri un terminale nella cartella `c:\VSC_Live_Server`
2. Avvia il server unificato:
   - `node unified-server.js`
3. Apri il browser su:
   - `http://localhost:5500/index.html`
   - `http://localhost:5500/diagnostica.html`
   - `http://localhost:5500/eventi/eventi.html`

## Percorsi importanti

- Pagina Eventi principale:
  - `http://localhost:5500/eventi/eventi.html`
- API ping Eventi:
  - `http://localhost:5500/eventi/api/ping`
- Visualizer Eventi:
  - `http://localhost:5500/eventi/visualizer.html`
- Altre pagine Eventi:
  - `http://localhost:5500/eventi/prenotati.html`
  - `http://localhost:5500/eventi/spuntati.html`
  - `http://localhost:5500/eventi/tutti.html`
  - `http://localhost:5500/eventi/non-spuntati.html`

## Perché non usare Live Server su 5500

- `5500` è già occupata da `unified-server.js`
- il progetto standard vuole l’alias `/eventi` gestito dal server unificato
- le API `/eventi/api/...` non funzionerebbero correttamente if Live Server usasse la stessa porta

## Consigli per spiegare il progetto

- Il progetto è principalmente statico, ma include un server Node che unifica:
  - file statici root
  - modulo Eventi
  - API di runtime
- Il server unificato garantisce che tutti gli URL funzionino insieme
- Live Server rimane utile solo per testare file statici in anteprima, non per eseguire l’app completa

## Bordero: fallback dati quando internet non e disponibile

Per il modulo Bordero, il flusso dati aggiornato prevede due sorgenti:

- Online: sincronizzazione da Google Sheets tramite Admin Panel.
- Offline: selezione file Excel locale e uso cache/CSV locali.

Percorso standard per i file Excel locali:

- `C:\VSC_Live_Server\Excel\`

Flusso consigliato in caso di assenza connessione:

1. Apri `http://localhost:5500/Bordero/pages/admin.html`.
2. Clicca `Seleziona File Excel...` e scegli un file dalla cartella `C:\VSC_Live_Server\Excel\`.
3. Esegui `Sincronizza Tutto da Excel`.
4. Continua a lavorare: Bordero usera localStorage e CSV locali come fallback.

## Verifica rapida

- `http://localhost:5500/eventi/eventi.html` deve rispondere con `200`
- `http://localhost:5500/eventi/api/ping` deve rispondere con `200`
- se Live Server viene avviato, deve ascoltare su `5503`

## Workflow Git (main/develop)

Per la procedura completa usa `GUIDA_GIT_MAIN_DEVELOP.md`.

### Aggiornare la copia locale dal remoto

```powershell
# Aggiorna i riferimenti remoti senza modificare il working tree
git fetch --all --prune

# Allinea develop locale
git checkout develop
git pull origin develop

# Allinea main locale
git checkout main
git pull origin main
```

### Sequenza standard add, commit e push

```powershell
git status
git add -A
git commit -m "feat: descrizione modifica"
git push
```

### Merge consigliato

- `feature/*` -> `develop` dopo test
- `develop` -> `main` preferibilmente via Pull Request


## Comandi PowerShell consigliati

Apri PowerShell in `c:\VSC_Live_Server` e usa:

```powershell
# Avvia il server unificato
node unified-server.js

# Verifica che Eventi risponda
Invoke-WebRequest -Uri 'http://localhost:5500/eventi/api/ping' -UseBasicParsing

# Controlla il file HTML Eventi
Invoke-WebRequest -Uri 'http://localhost:5500/eventi/eventi.html' -UseBasicParsing
```

Se vuoi chiudere il processo `node` in esecuzione sulla porta 5500:

```powershell
Get-NetTCPConnection -LocalPort 5500 | Select-Object -ExpandProperty OwningProcess | Get-Process | Stop-Process
```

## Uso con macro Excel / CommandButton

- Le macro Excel che aprono pagine HTML devono puntare a `http://localhost:5500/...`
- In particolare, per le pagine Eventi usa sempre:
  - `http://localhost:5500/eventi/eventi.html`
  - `http://localhost:5500/eventi/visualizer.html`
- Se le macro usano URL locali con `127.0.0.1` o `localhost`, va bene, purché la porta sia `5500`
- Se le macro aprono pagine di anteprima statica, allora Live Server su `5503` può essere usato per test rapidi, ma non per il funzionamento finale delle API Eventi

## Note utili

- Se il browser mostra `Cannot GET /eventi/eventi.html`, significa che il server unificato non sta girando su `5500` o che un altro processo occupa la porta.
- Se ti serve un percorso diretto per il modulo Eventi, usa sempre `http://localhost:5500/eventi/eventi.html`.
