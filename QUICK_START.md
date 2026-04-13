# Quick Start

## Avvio consigliato
Il progetto va usato tramite il server unificato.

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
