# Workflow Automatico - Aggiornamento Report Dati

## 📋 Descrizione

Questo sistema aggiorna automaticamente i dati del report statistico (`border_data.json`) leggendo i dati da Excel ogni N minuti.

## 🗂️ File Creati

1. **generate_report_data.py** — Script Python che legge Excel e genera il JSON
2. **update_report_data.ps1** — Script PowerShell per gestire l'aggiornamento (loop o una tantum)
3. **setup_report_scheduler.ps1** — Script PowerShell per registrare il task in Task Scheduler
4. **setup_report_scheduler.bat** — File batch per eseguire facilmente come Amministratore

## 🚀 Installazione

### Opzione 1: Esecuzione Rapida (Consigliato)

1. **Leggi il file:** `setup_report_scheduler.bat`
2. **Fai click destro** su `setup_report_scheduler.bat`
3. Scegli: **"Esegui come amministratore"**
4. ✓ Il task verrà registrato con intervallo di **5 minuti**

### Opzione 2: Line di Comando (per intervallo personalizzato)

```powershell
# Come Amministratore:
powershell -ExecutionPolicy Bypass -File "C:\VSC_Live_Server\setup_report_scheduler.ps1" -Interval 10
```

Sostituisci `10` con l'intervallo desiderato in minuti.

### Opzione 3: Esecuzione Manuale (una tantum)

Se non vuoi creare un task permanente, esegui manualmente quando serve:

```powershell
C:/VSC_Live_Server/.venv/Scripts/python.exe C:\VSC_Live_Server\generate_report_data.py
```

## ⚙️ Come Funziona

1. **Task Scheduler** avvia il Python script ogni N minuti
2. **generate_report_data.py** legge i dati da Excel:
   - Foglio **borderò**: conta X in A12:A612 (totale eseguite) e quelle con valore in G
   - Foglio **Accoda 8+12**: conta righe non vuote D2:AA1000 (richieste QR) e top 5 coreografie
3. Genera **border_data.json** nella cartella `public/`
4. Le pagine HTML (Report.html, Report_white.html, Report_black.html) caricano i dati dal JSON

## 📊 Dati Generati in border_data.json

```json
{
  "totale_eseguite": 45,           // X in A12:A612 (borderò)
  "eseguite": 38,                  // X in A12:A612 con valore in G
  "non_eseguite": 7,               // Totale - Eseguite
  "richieste_qr": 55,              // Righe non vuote D:AA (Accoda 8+12)
  "coreografia_piu_richiesta": "Merengue",  // Nome più frequente
  "conteggio_piu_richiesta": 12,           // Occorrenze
  "top_5": [
    {"nome": "Merengue", "conteggio": 12},
    {"nome": "Tango", "conteggio": 10},
    ...
  ]
}
```

## 🔍 Monitoraggio

### Visualizzare il Task

```powershell
Get-ScheduledTask -TaskName "VSC_Report_DataUpdate"
```

### Visualizzare gli Ultimi Esecuzioni

```powershell
Get-ScheduledTaskInfo -TaskName "VSC_Report_DataUpdate"
```

### Leggere i Log

Il file log si trova in: `C:\VSC_Live_Server\logs\report_update.log`

Ogni aggiornamento registra data, ora, e risultato (successo/errore).

## 🛑 Gestione del Task

### Avvia il task manualmente

```powershell
Start-ScheduledTask -TaskName "VSC_Report_DataUpdate"
```

### Disabilita il task (non cancella)

```powershell
Disable-ScheduledTask -TaskName "VSC_Report_DataUpdate"
```

### Riabilita il task

```powershell
Enable-ScheduledTask -TaskName "VSC_Report_DataUpdate"
```

### Rimuovi il task

```powershell
Unregister-ScheduledTask -TaskName "VSC_Report_DataUpdate" -Confirm:$false
```

## ⚬ Modifica dell'Intervallo

Se vuoi cambiare l'intervallo (es. da 5 a 10 minuti):

1. **Rimuovi il task precedente:**
   ```powershell
   Unregister-ScheduledTask -TaskName "VSC_Report_DataUpdate" -Confirm:$false
   ```

2. **Registra il nuovo task con nuovo intervallo:**
   ```powershell
   powershell -ExecutionPolicy Bypass -File "C:\VSC_Live_Server\setup_report_scheduler.ps1" -Interval 10
   ```

## 🧹 Pulizia Log

I log si accumulano in `C:\VSC_Live_Server\logs\report_update.log`. Per eliminarli periodicamente:

```powershell
Remove-Item "C:\VSC_Live_Server\logs\report_update.log"
```

oppure mantenili solo degli ultimi 7 giorni con uno script separato.

## ⚠️ Note Importanti

- **Excel deve avere il file fisico**: Se il file Excel è spostato o rinominato, lo script fallirà
- **Privilegi Admin**: Il task è registrato per l'utente corrente. Se cambi utente, potrebbe non eseguirsi
- **File di lock**: Se Excel ha il file aperto con lock (file ~$...), lo script lo esclude automaticamente
- **Connessione di rete**: Non è richiesta per leggere Excel localmente

## 🔧 Troubleshooting

### Il task non esegue

1. Verifica che Pesci sia eseguito come Amministratore
2. Controlla il log: `C:\VSC_Live_Server\logs\report_update.log`
3. Verifica che il file Excel esiste e non è danneggiato

### Errore: "Python executable non trovato"

Assicurati che il virtual environment è stato configurato:
```powershell
cd C:\VSC_Live_Server
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install openpyxl
```

### Errore: "Foglio borderò non trovato"

Verifica il nome esatto del foglio Excel (potrebbe avere spazi o caratteri speciali).

---

**Creato il:** 15 Febbraio 2026
**Per il progetto:** VSC Live Server (Coreografie Report)
