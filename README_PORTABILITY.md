# Portability & Setup Guide

Questo progetto è stato preparato per essere più portabile e meno dipendente dal PC di sviluppo.

## Obiettivo

- Rimuovere riferimenti locali hard-coded
- usare configurazione centralizzata in `config/config.js`
- supportare `.env` e `.env.example`
- avviare il server con un launcher unico (`START-UNATTENDED.bat` / `START.bat`) o con lo script `npm run start:portable`
- evitare errori 404/405 dovuti a cartelle o endpoint non disponibili su PC nuovi

## Flusso operativo attivo

Il runtime standard del progetto è sempre `unified-server.js` sulla porta `5500`.
I metodi di avvio supportati nel 2026 sono:
- `START-UNATTENDED.bat` — avvio automatico senza interazione
- `npm run start:portable` — avvio portabile da script dedicato
- `node unified-server.js` — avvio diretto, utile per sviluppo locale

I setup multi-server storici (`server-manager.js`, `simple-server.js`, `pdf-server.js`, `static-server.js`, ecc.) sono da considerarsi legacy e non fanno parte del flusso standard attivo.

## File principali

- `config/config.js` — configurazione centrale
- `.env.example` — template di ambiente
- `scripts/start-portable.js` — avvio con verifica setup
- `scripts/diagnostic-check.js` — check rapido del sistema
- `START.bat` — launcher Windows rapido
- `START-UNATTENDED.bat` — launcher privo di interazioni

## Come usare

1. Clonare il progetto
2. Eseguire `npm install`
3. (opzionale) creare `.env` copiando `.env.example`
4. Eseguire `START-UNATTENDED.bat` oppure `npm run start:portable`
5. Aprire `http://localhost:5500`

## Riferimenti portabili

Preferire percorsi relativi o variabili ambiente rispetto a path Windows fissi come:

- `C:\VSC_Live_Server\...`
- `C:\VSC_SIAE\...` (cartella standard per gli export SIAE)
- `C:\VSC_WEBCAM\...`

Le configurazioni ora sono gestite in `config/config.js` e possono essere override con variabili d'ambiente.
