# Setup Google Sheets API - Guida Rapida

> ðŸ“Œ Questa documentazione fa parte della [guida unificata del progetto](../README.md).


## âš¡ Passaggi (5 minuti)

### 1ï¸âƒ£ Crea un Google Cloud Project

1. Vai a: **https://console.cloud.google.com/**
2. Clicca su **"Seleziona un progetto"** in alto a sinistra
3. Clicca su **"NUOVO PROGETTO"**
4. Nome: `Bordero-DJ` (o quello che preferisci)
5. Clicca **"Crea"**
6. Aspetta che il progetto sia creato (2-3 secondi)

### 2ï¸âƒ£ Abilita Google Sheets API

1. Nella ricerca in alto, scrivi: **"Google Sheets API"**
2. Clicca sul risultato
3. Clicca su **"ABILITA"** (pulsante blu)
4. Aspetta che si abiliti

### 3ï¸âƒ£ Genera una API Key

1. Nel menu a sinistra, vai a **Credenziali**
2. Clicca **"+ Crea credenziale"** in alto
3. Seleziona **"Chiave API"**
4. Copia la chiave che appare (es: `AIzaSyD...`)
5. Clicca **"Chiudi"**

### 4ï¸âƒ£ Salva la chiave nel progetto

Apri PowerShell e digita:
```powershell
cd "C:\\VSC_Live_Server"
node setup-google-api.js
```

Ti chiederÃ  di incollare la **API Key**. Incollala e premi **Enter**.

âœ… **Fatto!** La chiave Ã¨ salvata in `Bordero/config/.env`

---

## ðŸ“ Configurazione Sheets (giÃ  fatto âœ…)

Le tre Google Sheets sono giÃ  pubbliche e configurate:

| Nome | Sheet ID | Uso |
|------|----------|-----|
| **Brani** | `1vWgzzwSHL2hK9RGvP87sCy_AtGGNTcDRM-h85bIpMMM` | Elenco Coreo (statico) - gid=0 |
| **Comuni** | `1235O_kj7vNHHpm7g24-n6WLsrdySBY3lls6s-h1l1L0` | Sheet1 - gid=0 |
| **DJ/dBase** | `137GoBHK098j4-4YwE4b4jhAmkcR_zV7u5Er75hR3Amc` | dBase - gid=1174825842 |

---

## ðŸš€ Avvia il Sync

Una volta configurato l'API Key, esegui:

```powershell
cd "C:\\VSC_Live_Server\Bordero\server"
npm install  # solo prima volta
node google-sheets-sync.js
```

Questo scarica tutti i dati in CSV:

- `Bordero/data/brani.csv`
- `Bordero/data/comuni_italia.csv`
- `Bordero/data/deejay.csv`

In alternativa puoi avviare il sync direttamente da Admin Panel:

- `http://localhost:5500/Bordero/pages/admin.html`
- Pulsante: `Sync da Google Sheets`
---

## ðŸ“¡ Se non c'e internet: fallback locale consigliato

Quando Google Sheets/API non sono raggiungibili:

1. Apri Admin Panel: `http://localhost:5500/Bordero/pages/admin.html`
2. Clicca `Seleziona File Excel...`
3. Scegli un file dalla directory: `C:\VSC_Live_Server\Excel\`
4. Esegui `Sincronizza Tutto da Excel`

Risultato:
- i dati restano disponibili da cache locale (`localStorage`)
- i CSV locali vengono usati come fallback operativo.

---

## â“ Problemi?

**"API Key non valida"**
- Verifica di aver copiato l'intera chiave (senza spazi)
- Ricrea la chiave: Credenziali > Chiave API > Ricrea

**"Sheet non trovato"**
- Verifica che la sheet sia condivisa in lettura
- Controlla l'ID della sheet (copia il link della Google Sheet, estrai l'ID dalla URL)
- Se la sheet Ã¨ pubblicata con "Pubblica sul web", puoi anche usare un URL CSV/TSV pubblico nel file `Bordero/config/.env`

**"Quota superato"**
- Non dovrebbe accadere con il piano gratuito
- Se accade, attendi un'ora e riprova

---

## ðŸ“– Riferimenti

- [Google Sheets API Docs](https://developers.google.com/sheets/api/guides/values/read)
- [API Key Setup](https://cloud.google.com/docs/authentication/api-keys)

## Verifica esito import

Le schede "Risposte del modulo 8" e "Risposte del modulo 12" possono anche contenere solo le intestazioni. In questo caso il sync è valido: il CSV Accoda contiene le sole intestazioni e il conteggio delle richieste in `brani.csv` viene azzerato secondo le regole esistenti. Se mancano le intestazioni o non corrispondono a quelle attese, l'import fallisce e gli ultimi CSV validi vengono mantenuti.

Anche l'esportazione del Registro (`scripts/sync-registro-sheets.js`) annulla l'intero aggiornamento se una scheda non contiene righe dati, così gli ultimi CSV esportati restano disponibili invece di essere sostituiti da file vuoti.

## Sync automatico nel server unificato

Il server unificato aggiorna Bordero all'avvio e ogni minuto; importa inoltre tutte le schede del Registro Coreografie all'avvio e ogni ora. Entrambi gli aggiornamenti sono disponibili con un solo comando dal pannello Admin o tramite `POST /api/google-sheets/sync`; lo stato e gli eventuali errori sono esposti da `GET /api/google-sheets/sync/status`.

L'ID del Registro predefinito è `1SNiw3qc6bZ76duNSxIzxZ2GKHKO8XUpIcl_jZbXs5wY` e può essere sostituito con `REGISTRO_GOOGLE_SHEET_ID` in `Bordero/config/.env`. Per disabilitare uno scheduler impostare `BORDERO_GOOGLE_SYNC_ENABLED=false` o `REGISTRO_GOOGLE_SYNC_ENABLED=false`. I CSV del Registro sono salvati nella cartella locale `Registro/`; non viene eseguito alcun deploy Firebase automatico.
