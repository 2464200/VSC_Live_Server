# Porte del progetto VSC Live Server

Questo file raccoglie lo schema aggiornato delle porte usate dal progetto, così da avere un riferimento rapido durante la programmazione e nel debug.

## Runtime attivo oggi

### 5500 — unified-server.js
- Server principale del progetto
- Serve la root del repository, Borderò, Eventi e le API condivise
- È il flusso standard attuale del progetto
- URL principali:
  - http://localhost:5500/index.html
  - http://localhost:5500/Bordero/pages/bordero.html
  - http://localhost:5500/eventi/eventi.html
  - http://localhost:5500/api/health

### 5501 — Live Server / anteprima editor
- Usato per preview statiche in VS Code
- Non è il runtime principale del progetto
- Impostato in `.vscode/settings.json`

### 5512 — controllo Electron
- Porta usata da `electron/main.js` per il controllo del launcher Electron
- Non è la porta di servizio del sito web

### 4212 — controllo remoto VLC
- Porta usata da `unified-server.js` per i comandi VLC sul monitor secondario
- Usata principalmente nelle funzionalità VideoClip / VLC

## Porte legacy / storiche

Le seguenti porte sono ancora citate nel repository ma non fanno parte del flusso standard attuale:

- 3000
- 3010
- 8765

Queste erano relative al vecchio setup multi-server e sono da considerarsi storiche, non attive nel percorso standard odierno.

## File principali dove sono definite

- `unified-server.js`
  - porta principale: 5500
  - fallback: 5501, 5502
  - VLC remote control: 4212
- `electron/main.js`
  - controllo Electron: 5512
- `.vscode/settings.json`
  - Live Server: 5501

## Nota importante

Il progetto usa ora come standard:

- `unified-server.js` su `http://localhost:5500`
- le porte `3000`, `3010`, `8765` sono legacy/storiche

## Shortcut utili

- Home: http://localhost:5500/index.html
- Borderò: http://localhost:5500/Bordero/pages/bordero.html
- Eventi: http://localhost:5500/eventi/eventi.html
- API health: http://localhost:5500/api/health
