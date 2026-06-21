# Setup Google Sheets API - Guida Rapida

> 📌 Questa documentazione fa parte della [guida unificata del progetto](../README.md).


## ⚡ Passaggi (5 minuti)

### 1️⃣ Crea un Google Cloud Project

1. Vai a: **https://console.cloud.google.com/**
2. Clicca su **"Seleziona un progetto"** in alto a sinistra
3. Clicca su **"NUOVO PROGETTO"**
4. Nome: `Bordero-DJ` (o quello che preferisci)
5. Clicca **"Crea"**
6. Aspetta che il progetto sia creato (2-3 secondi)

### 2️⃣ Abilita Google Sheets API

1. Nella ricerca in alto, scrivi: **"Google Sheets API"**
2. Clicca sul risultato
3. Clicca su **"ABILITA"** (pulsante blu)
4. Aspetta che si abiliti

### 3️⃣ Genera una API Key

1. Nel menu a sinistra, vai a **Credenziali**
2. Clicca **"+ Crea credenziale"** in alto
3. Seleziona **"Chiave API"**
4. Copia la chiave che appare (es: `AIzaSyD...`)
5. Clicca **"Chiudi"**

### 4️⃣ Salva la chiave nel progetto

Apri PowerShell e digita:
```powershell
cd "C:\VSC_Live_Server - WEB.worktrees\agents-bordero-html-css-js-conversion"
node setup-google-api.js
```

Ti chiederà di incollare la **API Key**. Incollala e premi **Enter**.

✅ **Fatto!** La chiave è salvata in `Bordero/config/.env`

---

## 📝 Configurazione Sheets (già fatto ✅)

Le tre Google Sheets sono già pubbliche e configurate:

| Nome | Sheet ID | Uso |
|------|----------|-----|
| **Brani** | `1vWgzzwSHL2hK9RGvP87sCy_AtGGNTcDRM-h85bIpMMM` | Elenco Coreo (statico) - gid=0 |
| **Comuni** | `1235O_kj7vNHHpm7g24-n6WLsrdySBY3lls6s-h1l1L0` | Sheet1 - gid=0 |
| **DJ/dBase** | `137GoBHK098j4-4YwE4b4jhAmkcR_zV7u5Er75hR3Amc` | dBase - gid=1174825842 |

---

## 🚀 Avvia il Sync

Una volta configurato l'API Key, esegui:

```powershell
cd "C:\VSC_Live_Server - WEB.worktrees\agents-bordero-html-css-js-conversion\Bordero\server"
npm install  # solo prima volta
node google-sheets-sync.js
```

Questo scarica tutti i dati in CSV:

- `Bordero/data/brani.csv`
- `Bordero/data/comuni_italia.csv`
- `Bordero/data/dbase.csv`
---

## ❓ Problemi?

**"API Key non valida"**
- Verifica di aver copiato l'intera chiave (senza spazi)
- Ricrea la chiave: Credenziali > Chiave API > Ricrea

**"Sheet non trovato"**
- Verifica che la sheet sia condivisa in lettura
- Controlla l'ID della sheet (copia il link della Google Sheet, estrai l'ID dalla URL)
- Se la sheet è pubblicata con "Pubblica sul web", puoi anche usare un URL CSV/TSV pubblico nel file `Bordero/config/.env`

**"Quota superato"**
- Non dovrebbe accadere con il piano gratuito
- Se accade, attendi un'ora e riprova

---

## 📖 Riferimenti

- [Google Sheets API Docs](https://developers.google.com/sheets/api/guides/values/read)
- [API Key Setup](https://cloud.google.com/docs/authentication/api-keys)

