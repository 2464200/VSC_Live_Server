**⚠️ Nota importante:** a partire dal 13 Apr 2026 il flusso standard del progetto usa un unico unified-server.js su http://localhost:5500. Le architetture con server-manager.js, pdf-server.js, simple-server.js, static-server.js, pdf-server-simple.js e le porte 3000, 3010, 8765 sono ora legacy/historiche e non fanno parte del percorso standard.

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
|- test-system.js            # Test integritÃ  del server unificato
|- pdf/                      # Sistema PDF dedicato
|  |- servers/               # Server PDF standalone
|  |- scripts/               # Script gestione PDF
|  |- viewers/               # Interfacce web PDF
|  |- config/                # Configurazione PDF
|  â””â”€ README.md              # Documentazione PDF
|- Eventi/
|  |- eventi-server.js       # Router API Eventi (integrato in unified)
|  |- server-eventi.js       # Standalone legacy (non avviato)
|- DASH/                     # Script AutoHotkey per kiosk
|- public/                   # File deployati su Firebase
```

### Note su Server e Porte
- **Porta unica 5500**: Tutto centralizzato su `localhost:5500` per semplicitÃ  e performance
- **Sistema PDF**: Integrato in unified-server, organizzato in `pdf/` con viewer dedicati
- **Server legacy rimossi**: `static-server.js`, `simple-server.js`, `pdf-server.js` eliminati (duplicati inutilizzati)
- **Server standalone**: `pdf/servers/pdf-server-simple.js`, `server-manager.js`, `server-eventi.js` mantenuti per compatibilitÃ  ma NON avviati automaticamente
- **Unificazione localhost**: Tutti i server ora ascoltano su `localhost` invece di IP specifici per portabilitÃ 
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

## Commit e GitHub
Un `commit` e' un salvataggio versionato dello stato del progetto dentro Git. Serve per fissare un punto stabile, descrivere cosa e' cambiato e poter poi sincronizzare tutto con GitHub.

Flusso base consigliato:

```powershell
git status
git add .
git commit -m "messaggio chiaro e breve"
```

### Configurazione locale prima
Se vuoi che nome ed email valgano solo per questo repository, usa la configurazione locale:

```powershell
git config user.name "Il Tuo Nome"
git config user.email "tuamail@example.com"
```

Questo e' l'approccio migliore quando vuoi un setup "privato" o limitato al solo progetto corrente.

### Configurazione globale dopo
Se in futuro vuoi riutilizzare gli stessi dati su tutti i repository del computer, imposta i valori globali:

```powershell
git config --global user.name "Il Tuo Nome"
git config --global user.email "tuamail@example.com"
```

### Push verso GitHub
Per collegare il repository locale a GitHub:

```powershell
git remote add origin https://github.com/<utente>/<repo>.git
git branch -M main
git push -u origin main
```

Dopo il primo push, in genere basta:

```powershell
git push
```

### Nota importante su privato e pubblico
`git push` non rende da solo un repository `private` o `public`: la visibilita' si decide nelle impostazioni del repository su GitHub.

Schema pratico:
- prima crea o usa un repository GitHub `private` se vuoi pubblicare il codice solo in modo riservato
- poi esegui `git push -u origin main`
- in futuro, se vorrai renderlo pubblico, cambia la visibilita' del repository direttamente su GitHub da `private` a `public`

In altre parole:
- `git config ...` controlla identita' e ambito locale o globale
- `git remote ...` controlla dove fai push
- GitHub controlla la visibilita' reale del repository

### Parametri utili da ricordare
- `--global`: applica nome/email a tutti i repository del computer
- senza `--global`: applica nome/email solo al repository corrente
- `-u` in `git push -u origin main`: salva il branch remoto di riferimento per i push successivi
- `origin`: nome standard del repository remoto GitHub
- `main`: branch principale

### Verifiche rapide
```powershell
git config user.name
git config user.email
git remote -v
git status
```

## Documentazione
- [Automazione Completa](AUTOMAZIONE_COMPLETA.md)
- [README Eventi](Eventi/README_EVENTI.md)
- [README Server Manager](README_SERVER_MANAGER.md)


