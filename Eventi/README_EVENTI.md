**⚠️ Nota importante:** a partire dal 13 Apr 2026 il flusso standard del progetto usa un unico unified-server.js su http://localhost:5500. Le architetture con server-manager.js, pdf-server.js, simple-server.js, static-server.js, pdf-server-simple.js e le porte 3000, 3010, 8765 sono ora legacy/historiche e non fanno parte del percorso standard.

# Sistema Eventi

## Panoramica
Il modulo `Eventi` gestisce prenotazione, esecuzione e monitoraggio delle coreografie DJ.

Nel progetto attuale il percorso standard e':

- `http://localhost:5500/eventi/eventi.html`

Il server standalone `Eventi/server-eventi.js` e' solo legacy e non serve nel flusso normale.

## Funzioni principali
- selezione DJ
- stati `disponibile`, `prenotato`, `eseguito`
- viste filtrate
- annulla prenotazione direttamente dalla vista `Prenotati`
- gestione e modifica coreografie aggiuntive da CSV dedicato
- export CSV
- visualizer live read-only
- statistiche DJ con media per DJ formattata a 2 decimali
- limite prenotazioni DJ basato sui brani attualmente in stato `prenotato` (non sui brani già eseguiti)
- reset cronologia date/orari per avvio nuovo evento
- ritorno automatico alla home Eventi dopo 60 secondi di inattivita'

## URL utili
- Home Eventi: `http://localhost:5500/eventi/eventi.html`
- Prenotati: `http://localhost:5500/eventi/prenotati.html`
- Eseguiti: `http://localhost:5500/eventi/spuntati.html`
- Non eseguiti: `http://localhost:5500/eventi/non-spuntati.html`
- Tutti: `http://localhost:5500/eventi/tutti.html`
- Coreografie Aggiuntive: `http://localhost:5500/eventi/coreografie-aggiuntive.html`
- Statistiche DJ: `http://localhost:5500/eventi/statistiche-dj.html`
- DJ Manager: `http://localhost:5500/eventi/dj-manager.html`
- Admin Eventi: `http://localhost:5500/eventi/admin.html`
- Visualizer: `http://localhost:5500/eventi/visualizer.html`
- API base: `http://localhost:5500/eventi/api`

## Architettura
```text
Eventi/
|- eventi-server.js       # Router API Eventi
|- server-eventi.js       # Standalone legacy opzionale
|- sync-brani.js
|- data/
|  |- brani.json
|  |- log.json
|  |- dj.json
|- public/
   |- eventi.html
   |- prenotati.html
   |- spuntati.html
   |- non-spuntati.html
   |- tutti.html
   |- coreografie-aggiuntive.html
   |- statistiche-dj.html
   |- visualizer.html
   |- inactivity-return.js
   |- api-helper.js
   |- stati.js
   |- eventi.js
   |- render.js
   |- coreografie-aggiuntive.js
   |- style.css
```

## Avvio consigliato
1. apri il progetto root in VS Code
2. lascia partire `startup.ps1`
3. usa `http://localhost:5500/eventi/eventi.html`

> Per tablet o PC in rete, usa l'indirizzo locale mostrato in console, ad esempio `http://<IP_locale>:5500/eventi/eventi.html`.
> La pagina `qr.html` ora genera un QR con l'URL di rete corretto, non solo `localhost`.
>
> Se stai usando una Vodafone Station Revolution, configura il router in modo che crei una rete wireless locale unica per l'evento, disabiliti l'isolamento client/ap e lasci il server e i DJ sulla stessa subnet.

## Avvio legacy opzionale
```powershell
cd Eventi
node server-eventi.js
```

Solo in quel caso useresti `http://localhost:3010/eventi/eventi.html`, ma non e' il percorso consigliato del progetto.

## API
Base URL:

```text
http://localhost:5500/eventi/api
```

Endpoint:
- `GET /brani`
- `GET /log`
- `POST /log`
- `POST /log/reset-times`
- `GET /dj`
- `POST /dj`
- `DELETE /dj/:id`
- `GET /export-csv`
- `GET /sync-brani`
- `POST /aggiuntive/delete` (elimina coreografia da CSV aggiuntivo)
- `DELETE /aggiuntive/:id` (fallback equivalente per eliminazione)
- `POST /aggiuntive/update` (aggiorna coreografia da CSV aggiuntivo)
- `POST /check-prenotazione-limit` (verifica se un DJ può prenotare una nuova coreografia in base ai prenotati correnti)

## Note operative
- In tutte le pagine HTML del modulo `Eventi`, dopo 60 secondi senza interazioni utente si torna automaticamente a `eventi.html`.
- Nella home `eventi.html` e' presente il pulsante `Reset date e orari`, che azzera la cronologia corrente del modulo per iniziare un nuovo evento e resetta anche il conteggio delle prenotazioni DJ attive.
- Il reset salva prima una copia del log precedente in `Eventi/data/archive/`.
- Nella vista `prenotati.html` e' disponibile un checkbox `Annulla` che riporta il brano a stato `disponibile`, come avviene nella vista `spuntati.html`.
- Il conteggio del limite di prenotazione DJ considera solo i brani attualmente in stato `prenotato`; i brani già `eseguito` non influiscono sul conteggio. Quando il numero di prenotati diminuisce (esecuzione o annullamento), il DJ può prenotare nuovamente fino al limite assegnato.
- La pagina `coreografie-aggiuntive.html` consente di visualizzare l'elenco delle coreografie contenute in `Coreografie_Aggiuntive.csv`. La maschera di modifica rimane nascosta al caricamento della pagina e si apre solo quando l'utente clicca il pulsante "Modifica" su un brano specifico.
- Nella stessa pagina e' disponibile anche il pulsante `Elimina`, che rimuove la coreografia sia dall'elenco mostrato sia dal file `Coreografie_Aggiuntive.csv`.
- La sincronizzazione brani usa come sorgente principale `Eventi/Elenco_Brani_statico.csv`; `display.csv` resta solo come fallback legacy/compatibilita' se il file completo non e' disponibile.
- Le etichette di navigazione correnti sono `Eseguiti`, `Non eseguiti`, `Prenotati`, `Mostra tutto`, `Statistiche DJ`, `Coreografie Aggiuntive`, `Apri visualizer`.
- Il visualizer usa il solo percorso canonico `http://localhost:5500/eventi/visualizer.html` per evitare loop di redirect.

## Troubleshooting
- verifica `http://localhost:5500/eventi/api/ping`
- apri `http://localhost:5500/diagnostica.html`
- esegui `node Eventi/sync-brani.js` se i brani non sono allineati

## Nota
I riferimenti a `3010` nella documentazione storica sono da considerare legacy.


