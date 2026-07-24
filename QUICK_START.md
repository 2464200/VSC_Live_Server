> 📌 Questa documentazione fa parte della [guida unificata del progetto](README.md).

**⚠️ Nota importante:** a partire dal 13 Apr 2026 il flusso standard del progetto usa un unico unified-server.js su http://localhost:5500. Le architetture con server-manager.js, pdf-server.js, simple-server.js, static-server.js, pdf-server-simple.js e le porte 3000, 3010, 8765 sono ora legacy/historiche e non fanno parte del percorso standard.

# Quick Start

## Avvio consigliato
Il progetto va usato tramite il server unificato.

Prima dell'avvio, allinea la copia locale con il remoto:

```powershell
git fetch --all --prune
git checkout develop
git pull origin develop
```

Per i dettagli completi su `add`, `commit`, `push`, `pull`, `merge`, `fetch` usa `GUIDA_GIT_MAIN_DEVELOP.md`.

```powershell
cd C:\VSC_Live_Server
.\startup.ps1 -NoWait
```

Oppure apri la cartella in VS Code e lascia partire il task automatico.

## URL corretti
- Home: `http://localhost:5500/index.html`
- Diagnostica: `http://localhost:5500/diagnostica.html`
- PDF: `http://localhost:5500/Prova/ScriptPDF1.html`
- Eventi: `http://localhost:5500/eventi/eventi.html`
- Visualizer: `http://localhost:5500/eventi/visualizer.html`

## Regola importante
- usa `5500` per il progetto
- non usare `Go Live` per le pagine del progetto
- Live Server in VS Code, se attivato, e' solo un server statico separato e non e' il runtime corretto del sistema

## Controlli rapidi
```powershell
node test-system.js
```

## Se qualcosa non funziona
1. verifica `http://localhost:5500/diagnostica.html`
2. verifica `http://localhost:5500/eventi/api/ping`
3. chiudi eventuali tab aperti su porte diverse da `5500`



