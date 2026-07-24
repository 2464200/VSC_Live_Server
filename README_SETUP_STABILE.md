> 📌 Questa documentazione fa parte della [guida unificata del progetto](README.md).

**⚠️ Nota importante:** a partire dal 13 Apr 2026 il flusso standard del progetto usa un unico unified-server.js su http://localhost:5500. Le architetture con server-manager.js, pdf-server.js, simple-server.js, static-server.js, pdf-server-simple.js e le porte 3000, 3010, 8765 sono ora legacy/historiche e non fanno parte del percorso standard.

# Configurazione stabile

## Stato attuale del progetto
La configurazione stabile usa:

- `unified-server.js`
- porta `5500`

Il server unificato incorpora:
- pagine statiche
- API PDF
- API Eventi

## Avvio
```powershell
cd C:\VSC_Live_Server
.\startup.ps1 -NoWait
```

## URL di riferimento
- `http://localhost:5500/index.html`
- `http://localhost:5500/diagnostica.html`
- `http://localhost:5500/Prova/ScriptPDF1.html`
- `http://localhost:5500/eventi/eventi.html`
- `http://localhost:5500/eventi/visualizer.html`

## Cosa evitare
- non usare `Go Live` per avviare il progetto
- non considerare `5502`, `3010`, `3000` o `8765` come percorso standard

## Verifiche
```powershell
node test-system.js
```

## Workflow Git consigliato

Aggiorna prima il locale dal remoto:

```powershell
git fetch --all --prune
git checkout develop
git pull origin develop
```

Sequenza standard per salvare le modifiche:

```powershell
git status
git add -A
git commit -m "docs: aggiornamento setup stabile"
git push
```

Per merge e promozione `develop -> main`: `GUIDA_GIT_MAIN_DEVELOP.md`.

Controlli attesi:
- server unificato raggiungibile
- PDF API integrata raggiungibile
- Eventi API integrata raggiungibile

## Note
Live Server puo' esistere come strumento editoriale, ma non rappresenta l'esecuzione corretta del progetto.



