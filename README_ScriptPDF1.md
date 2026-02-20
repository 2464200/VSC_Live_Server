# ScriptPDF1 - Gestione PDF per Excel

Sistema per aprire e gestire file PDF da una cartella dedicata (`C:\SCRIPT_PDF`) attraverso un'interfaccia web grafica integrata con Excel.

## 📋 Caratteristiche

- **Interfaccia grafica**: Pagina HTML con stile consistente (tema nero/arancione come Report_black.html)
- **Gestione PDF**: ComboBox per selezionare file PDF, pulsanti di navigazione
- **Modalità Kiosk**: Apertura di Chrome a schermo intero sul monitor secondario
- **Controllo da Excel**: Integrazione con VBA per lanciare e controllare la sessione
- **API REST**: Server Node.js per la comunicazione tra interfaccia e sistema operativo

## 🛠️ Requisiti

1. **Node.js** (v14+) - [Scarica da nodejs.org](https://nodejs.org/)
2. **Google Chrome** - Browser per visualizzare i PDF
3. **Excel** - Per il controllo tramite VBA (opzionale)
4. **Windows 10/11** - Sistema operativo supportato

## 📦 Installazione

### 1. Installa le dipendenze Node.js

```powershell
cd C:\VSC_Live_Server
npm install
```

Se manca la cartella `node_modules`, verrà creata automaticamente.

### 2. Crea la cartella per i PDF

```powershell
New-Item -ItemType Directory -Path "C:\SCRIPT_PDF" -Force
```

Aggiungi i tuoi file PDF in questa cartella.

### 3. Verifica Chrome

Assicurati che Chrome sia installato nel percorso standard:
- `C:\Program Files\Google\Chrome\Application\chrome.exe`
- `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`

## 🚀 Utilizzo

### Opzione 1: Avvio manuale da PowerShell

```powershell
# Dal percorso C:\VSC_Live_Server
.\Start_ScriptPDF1.ps1
```

### Opzione 2: Avvio da Excel (VBA)

Aggiungi questo codice al tuo modulo VBA:

```vba
Sub ApriGestorePDF()
    Dim shell As Object
    Dim scriptPath As String
    
    Set shell = CreateObject("WScript.Shell")
    scriptPath = "C:\VSC_Live_Server\Start_ScriptPDF1.ps1"
    
    ' Esegui lo script PowerShell
    shell.Run "powershell -NoProfile -ExecutionPolicy Bypass -File """ & scriptPath & """", 1, False
End Sub
```

Quindi chiama `ApriGestorePDF()` quando necessario.

## 📖 Guida all'uso

### Pagina ScriptPDF1.html

1. **Selezione file**: Usa la ComboBox per scegliere il PDF
2. **Navigazione**:
   - **Precedente** (◀): Vai al file precedente nella lista
   - **Successivo** (▶): Vai al file successivo nella lista
3. **Apertura**: Fai doppio click sulla ComboBox o sul nome del PDF per aprire il file selezionato
4. **Chiusura**: Clicca su **Chiudi (✕)** per terminare la sessione e tornare ad Excel

## 🔧 Struttura del progetto

```
C:\VSC_Live_Server\
├── pdf-server.js           # Server Node.js (porta 8765)
├── Start_ScriptPDF1.ps1    # Script PowerShell per avviare tutto
├── update_pdf_list.ps1     # Script per generare lista PDF (opzionale)
├── package.json            # Dipendenze Node.js
└── Prova\
    └── ScriptPDF1.html     # Interfaccia grafica
```

## 🌐 API REST

Il server fornisce le seguenti API:

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

## ⚙️ Configurazione avanzata

### Monitor secondario

Lo script `Start_ScriptPDF1.ps1` rileva automaticamente il monitor secondario. Se hai problemi:

1. Modifica lo script per specificare esplicitamente le coordinate:
```powershell
# Esempio: apertura su specifica posizione
--window-position=1920,0 --window-size=1920,1080
```

### Porta personalizzata

Se la porta 8765 è in uso, modifica:
1. **pdf-server.js**: cambia `const PORT = 8765` su un'altra porta
2. **ScriptPDF1.html**: aggiorna i fetch da `http://localhost:8765/...` alla nuova porta
3. **Start_ScriptPDF1.ps1**: aggiorna `$htmlUrl`

## 🐛 Troubleshooting

### "Chrome non trovato"
**Soluzione**: Installa Google Chrome oppure verifica il percorso di installazione

### "Server non risponde"
**Soluzione**: 
```powershell
# Assicurati di essere nella cartella giusta
cd C:\VSC_Live_Server

# Verifica che Express sia installato
npm list express

# Se manca, installa:
npm install
```

### PDF non si apre
**Soluzione**: 
1. Verifica che i file PDF siano in `C:\SCRIPT_PDF`
2. Aggiorna la lista: `.\update_pdf_list.ps1`
3. Controlla i log della console del server

### Problema con il monitor secondario
**Soluzione**: 
1. Nella PowerShell, esegui senza il flag `-Secondary`
2. Oppure modifica lo script per specificare manualmente le coordinate

## 📝 Note

- La lista dei PDF viene caricata in tempo reale dal server
- Chrome si apre automaticamente in modalità Kiosk (schermo intero, nessun menu)
- Chiudendo lo script PowerShell, si chiude automaticamente Chrome e il server
- I file PDF rimangono nella cartella `C:\SCRIPT_PDF`

## 📞 Supporto

Per problemi o domande:
1. Controlla i log della console di PowerShell
2. Verifica le dipendenze Node.js
3. Assicurati che Chrome sia correttamente installato
4. Controlla se la porta 8765 è già in uso: `netstat -an | findstr 8765`

---

**Versione**: 1.0.0  
**Data**: 19 Febbraio 2026  
**Author**: VSC_Live_Server
