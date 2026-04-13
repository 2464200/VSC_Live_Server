**⚠️ Nota importante:** a partire dal 13 Apr 2026 il flusso standard del progetto usa un unico unified-server.js su http://localhost:5500. Le architetture con server-manager.js, pdf-server.js, simple-server.js, static-server.js, pdf-server-simple.js e le porte 3000, 3010, 8765 sono ora legacy/historiche e non fanno parte del percorso standard.

# ScriptPDF1 - Gestione PDF per Excel

Sistema per aprire e gestire file PDF da una cartella dedicata (`C:\SCRIPT_PDF`) attraverso un'interfaccia web grafica integrata con Excel.

**Nota:** Questo sistema è ora integrato nel unified server principale su `http://localhost:5500`. Non richiede server separati.

## ðŸ“‹ Caratteristiche

- **Interfaccia grafica**: Pagina HTML con stile consistente (tema nero/arancione come Report_black.html)
- **Gestione PDF**: ComboBox per selezionare file PDF, pulsanti di navigazione
- **ModalitÃ  Kiosk**: Apertura di Chrome a schermo intero sul monitor secondario
- **Controllo da Excel**: Integrazione con VBA per lanciare e controllare la sessione
- **API REST**: Endpoint integrati nel unified server per la comunicazione tra interfaccia e sistema operativo

## ðŸ› ï¸ Requisiti

1. **Node.js** (v14+) - [Scarica da nodejs.org](https://nodejs.org/)
2. **Google Chrome** - Browser per visualizzare i PDF
3. **Excel** - Per il controllo tramite VBA (opzionale)
4. **Windows 10/11** - Sistema operativo supportato

## ðŸ“¦ Installazione

### 1. Installa le dipendenze Node.js

```powershell
cd C:\VSC_Live_Server
npm install
```

Se manca la cartella `node_modules`, verrÃ  creata automaticamente.

### 2. Crea la cartella per i PDF

```powershell
New-Item -ItemType Directory -Path "C:\SCRIPT_PDF" -Force
```

Aggiungi i tuoi file PDF in questa cartella.

### 3. Verifica Chrome

Assicurati che Chrome sia installato nel percorso standard:
- `C:\Program Files\Google\Chrome\Application\chrome.exe`
- `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`

## ðŸš€ Utilizzo

### Avvio automatico con il progetto

Il sistema PDF è integrato nel unified server. Avvia tutto con:

```powershell
cd C:\VSC_Live_Server
.\startup.ps1 -NoWait
```

Poi apri: `http://localhost:5500/pdf/viewers/ScriptPDF1.html`

### Opzione 2: Avvio da Excel (VBA)

Aggiungi questo codice al tuo modulo VBA:

```vba
Sub ApriGestorePDF()
    Dim shell As Object
    Dim url As String
    
    Set shell = CreateObject("WScript.Shell")
    url = "http://localhost:5500/pdf/viewers/ScriptPDF1.html"
    
    ' Apri Chrome in modalità kiosk sul monitor secondario
    shell.Run """C:\Program Files\Google\Chrome\Application\chrome.exe"" --app=""" & url & """ --new-window --window-position=1920,0 --window-size=1920,1080", 1, False
End Sub
```

Quindi chiama `ApriGestorePDF()` quando necessario.

## ðŸ“– Guida all'uso

### Pagina ScriptPDF1.html

1. **Selezione file**: Usa la ComboBox per scegliere il PDF
2. **Navigazione**:
   - **Precedente** (â—€): Vai al file precedente nella lista
   - **Successivo** (â–¶): Vai al file successivo nella lista
3. **Apertura**: Fai doppio click sulla ComboBox o sul nome del PDF per aprire il file selezionato
4. **Chiusura**: Clicca su **Chiudi (âœ•)** per terminare la sessione e tornare ad Excel

## ðŸ”§ Struttura del progetto

```
C:\VSC_Live_Server\
â”œâ”€â”€ unified-server.js       # Server principale (porta 5500) - include API PDF
â”œâ”€â”€ pdf/                     # Sistema PDF integrato
â”‚   â”œâ”€â”€ viewers/            # Interfacce web
â”‚   â”‚   â””â”€â”€ ScriptPDF1.html # Interfaccia principale
â”‚   â”œâ”€â”€ scripts/            # Script gestione
â”‚   â””â”€â”€ config/             # Configurazione
â”œâ”€â”€ startup.ps1             # Avvio automatico del tutto
â””â”€â”€ package.json            # Dipendenze Node.js
```

## ðŸŒ API REST

Gli endpoint PDF sono integrati nel unified server su porta 5500:

### GET `/api/pdf-list`
Ritorna la lista dei file PDF disponibili

**Response:**
```json
{
  "success": true,
  "timestamp": "19/02/2026 15:30:45",
  "folderPath": "C:\\SCRIPT_PDF",
  "totalFiles": 5,
  "files": [
    {
      "name": "documento1.pdf",
      "path": "C:\\SCRIPT_PDF\\documento1.pdf",
      "size": "2.50 MB",
      "created": "19/02/2026 10:15"
    }
  ]
}
```

### POST `/api/open-pdf`
Apre un file PDF in Chrome

**Request:**
```json
{
  "filePath": "C:\\SCRIPT_PDF\\documento1.pdf",
  "fileName": "documento1.pdf"
}
```

### POST `/api/close-chrome`
Chiude la sessione Chrome attuale

## âš™ï¸ Configurazione avanzata

### Monitor secondario

Il sistema rileva automaticamente il monitor secondario. Se hai problemi, modifica le coordinate nel codice VBA o negli script.

### Cartella PDF personalizzata

Se vuoi cambiare la cartella dei PDF, modifica la costante `PDF_FOLDER` nel unified-server.js.

## ðŸ› Troubleshooting

### "Chrome non trovato"
**Soluzione**: Installa Google Chrome oppure verifica il percorso di installazione

### "Server non risponde"
**Soluzione**: 
```powershell
# Assicurati che il unified server sia avviato
cd C:\VSC_Live_Server
.\startup.ps1 -NoWait

# Verifica che risponda
curl http://localhost:5500/api/pdf-list
```

### PDF non si apre
**Soluzione**: 
1. Verifica che i file PDF siano in `C:\SCRIPT_PDF`
2. Controlla i log del unified server
3. Assicurati che Chrome sia installato correttamente

### Problema con il monitor secondario
**Soluzione**: 
1. Modifica le coordinate nel codice VBA
2. Oppure apri manualmente senza kiosk mode per testare

## ðŸ“ Note

- La lista dei PDF viene caricata in tempo reale dal server
- Chrome si apre automaticamente in modalitÃ  Kiosk (schermo intero, nessun menu)
- Chiudendo la pagina, Chrome rimane aperto fino a chiusura manuale o tramite API
- I file PDF rimangono nella cartella `C:\SCRIPT_PDF`

## ðŸ“ž Supporto

Per problemi o domande:
1. Controlla i log del unified server
2. Verifica che il server sia avviato su porta 5500
3. Testa gli endpoint API direttamente
4. Assicurati che Chrome sia correttamente installato

---

**Versione**: 2.0.0 (Unified)  
**Data**: 19 Febbraio 2026  
**Author**: VSC_Live_Server


