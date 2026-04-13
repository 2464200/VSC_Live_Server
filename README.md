# VSC Live Server

Sistema locale per gestione pagine web, PDF ed Eventi con avvio e arresto automatizzati.

## Modello attuale
Il progetto gira normalmente con un solo server:

- `unified-server.js`
- porta `5500`

Questo server espone:
- frontend statico
- API PDF
- API Eventi

## URL principali
- Home: `http://localhost:5500/index.html`
- Diagnostica: `http://localhost:5500/diagnostica.html`
- PDF: `http://localhost:5500/Prova/ScriptPDF1.html`
- Eventi: `http://localhost:5500/eventi/eventi.html`
- DJ Manager: `http://localhost:5500/eventi/dj-manager.html`
- Admin Eventi: `http://localhost:5500/eventi/admin.html`
- Visualizer: `http://localhost:5500/eventi/visualizer.html`

## Avvio
Flusso consigliato:

1. apri la cartella `VSC_Live_Server` in VS Code
2. lascia partire `startup.ps1`
3. usa le pagine via `http://localhost:5500/...`

Comandi manuali:

```powershell
.\startup.ps1 -NoWait
.\shutdown.ps1
node test-system.js
```

## Architettura
```text
VSC_Live_Server/
|- unified-server.js         # Server principale su 5500 (UNICO ATTIVO)
|- startup.ps1               # Avvio automatico (solo unified-server)
|- shutdown.ps1              # Arresto automatico + consolidamento Git
|- test-system.js            # Test integrità del server unificato
|- pdf/                      # Sistema PDF dedicato
|  |- servers/               # Server PDF standalone
|  |- scripts/               # Script gestione PDF
|  |- viewers/               # Interfacce web PDF
|  |- config/                # Configurazione PDF
|  └─ README.md              # Documentazione PDF
|- Eventi/
|  |- eventi-server.js       # Router API Eventi (integrato in unified)
|  |- server-eventi.js       # Standalone legacy (non avviato)
|- DASH/                     # Script AutoHotkey per kiosk
|- public/                   # File deployati su Firebase
```

### Note su Server e Porte
- **Porta unica 5500**: Tutto centralizzato su `localhost:5500` per semplicità e performance
- **Sistema PDF**: Integrato in unified-server, organizzato in `pdf/` con viewer dedicati
- **Server legacy rimossi**: `static-server.js`, `simple-server.js`, `pdf-server.js` eliminati (duplicati inutilizzati)
- **Server standalone**: `pdf/servers/pdf-server-simple.js`, `server-manager.js`, `server-eventi.js` mantenuti per compatibilità ma NON avviati automaticamente
- **Unificazione localhost**: Tutti i server ora ascoltano su `localhost` invece di IP specifici per portabilità
|  |- data/
|  |- public/
|- Prova/
|- public/
|- .vscode/
```

## Note importanti
- `5500` e' la porta di riferimento del progetto
- `3010` resta solo come percorso legacy per `Eventi` standalone
- `3000` e `8765` non sono richieste nel flusso standard unificato

## Documentazione
- [Automazione Completa](AUTOMAZIONE_COMPLETA.md)
- [README Eventi](Eventi/README_EVENTI.md)
- [README Server Manager](README_SERVER_MANAGER.md)
