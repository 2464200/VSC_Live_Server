# Guida d'uso del progetto VSC Live Server

## Panoramica
Questo progetto usa il server unificato `unified-server.js` sulla porta standard `5500`. Tutte le pagine principali del progetto e i mock API Eventi sono servite da questo server.

VS Code Live Server può essere usato per anteprime statiche su una porta separata (`5501`) ma non può sostituire il server unificato su `5500`.

## Server e porte

- `5500` → `unified-server.js`
  - serve file statici dalla root del progetto
  - serve il modulo Eventi su `/eventi`
  - serve API Eventi su `/eventi/api`
- `5501` → Live Server (anteprima statica)
  - utile solo per visualizzare HTML/CSS/JS statico
  - non serve le API Eventi del progetto

## Configurazione corrente
Nel file `c:\VSC_Live_Server\.vscode\settings.json` è impostato:

```json
{
  "liveServer.settings.port": 5501,
  "liveServer.settings.host": "127.0.0.1"
}
```

## Come avviare il progetto reale

1. Apri un terminale nella cartella `c:\VSC_Live_Server`
2. Avvia il server unificato:
   - `node unified-server.js`
3. Apri il browser su:
   - `http://localhost:5500/index.html`
   - `http://localhost:5500/diagnostica.html`
   - `http://localhost:5500/eventi/eventi.html`

## Uso di Live Server

Se vuoi usare Live Server per anteprime veloci:

1. Avvia Live Server da VS Code nella cartella `c:\VSC_Live_Server`
2. Accertati che usi porta `5501`
3. Apri:
   - `http://localhost:5501/index.html`
   - `http://localhost:5501/Eventi/public/eventi.html`

> Nota: le pagine Eventi aperte da Live Server cercheranno comunque le API su `5500`. Per funzionare correttamente, `unified-server.js` deve restare attivo.

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

## Verifica rapida

- `http://localhost:5500/eventi/eventi.html` deve rispondere con `200`
- `http://localhost:5500/eventi/api/ping` deve rispondere con `200`
- se Live Server viene avviato, deve ascoltare su `5501`

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
- Se le macro aprono pagine di anteprima statica, allora Live Server su `5501` può essere usato per test rapidi, ma non per il funzionamento finale delle API Eventi

## Note utili

- Se il browser mostra `Cannot GET /eventi/eventi.html`, significa che il server unificato non sta girando su `5500` o che un altro processo occupa la porta.
- Se ti serve un percorso diretto per il modulo Eventi, usa sempre `http://localhost:5500/eventi/eventi.html`.
