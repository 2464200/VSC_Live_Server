# 🚀 BORDERÒ - QUICK START GUIDE

## ⚡ Come Avviare il Progetto

### **OPZIONE 1: Python (Consigliato - Più Rapido)**

**Passo 1:** Apri PowerShell nella cartella del progetto
```powershell
cd C:\VSC_Live_Server - WEB.worktrees\agents-bordero-html-css-js-conversion
```

**Passo 2:** Avvia il server Python
```powershell
python -m http.server 8000
```

**Output atteso:**
```
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

**Passo 3:** Apri il browser
```
http://localhost:8000/Bordero/
```

---

### **OPZIONE 2: Node.js (Se hai Node.js installato)**

**Passo 1:** Apri PowerShell nella cartella del progetto
```powershell
cd C:\VSC_Live_Server - WEB.worktrees\agents-bordero-html-css-js-conversion
```

**Passo 2:** Installa http-server globalmente (prima volta solo)
```powershell
npm install -g http-server
```

**Passo 3:** Avvia il server
```powershell
http-server -c-1 -p 8000
```

**Passo 4:** Apri il browser
```
http://localhost:8000/Bordero/
```

---

### **OPZIONE 3: Live Server VS Code (Se usi VS Code)**

**Passo 1:** Installa estensione "Live Server" (di Ritwick Dey)
- Apri VS Code Extensions (Ctrl+Shift+X)
- Cerca "Live Server"
- Clicca Install

**Passo 2:** Click destro su `/Bordero/index.html`
- Seleziona "Open with Live Server"
- Il browser si apre automaticamente

---

## 🌐 Quali URL Usare

Dopo aver avviato il server, usa questi URL:

| Pagina | URL | Descrizione |
|--------|-----|-------------|
| **🏠 Home** | http://localhost:8000/Bordero/ | Pagina principale |
| **📋 Bordero (PRINCIPALE)** | http://localhost:8000/Bordero/pages/bordero.html | Tabella gestione brani |
| **🎬 NextCoreo** | http://localhost:8000/Bordero/pages/next-coreo.html | Fullscreen prossima canzone |
| **📺 Monitor** | http://localhost:8000/Bordero/pages/display.html | Monitor secondario (per secondo schermo) |
| **📊 Lista Serata** | http://localhost:8000/Bordero/pages/lista-serata.html | Report brani eseguiti |
| **📈 Risultati** | http://localhost:8000/Bordero/pages/risultati.html | Statistiche finali |
| **🎥 VideoClip** | http://localhost:8000/Bordero/pages/videoclip.html | Video player coreografie |

---

## ✅ Cosa Succede all'Avvio

1. ✅ La pagina carica la libreria XLSX.js
2. ✅ Legge il file Excel: `./Excel/Borderò - ver 13.1.69_con AutoHotkey da sistemare.xlsm`
3. ✅ Sincronizza automaticamente i dati da:
   - 📄 Foglio "Elenco Brani (statico)" → brani.csv
   - 📄 Foglio "Comuni Italia" → comuni_italia.csv
   - 📄 Foglio "dBase" → dBase.csv
4. ✅ Salva i dati in localStorage per accesso offline
5. ✅ Mostra la tabella con 28+ brani

---

## 🧪 Test Rapido (Primo Avvio)

Una volta aperto **bordero.html**:

1. **Verifica che la tabella carichi:**
   - Dovresti vedere ~28 brani
   - Se vuoto: controlla la console (F12) per errori

2. **Testa i dropdown:**
   - DJ dropdown → dovrebbe avere 3 opzioni
   - Location dropdown → dovrebbe avere 7 opzioni

3. **Marca un brano:**
   - Click su una riga
   - Dovrebbe apparire una "X" e la riga grigia
   - Il brano scivola in fondo

4. **Testa l'export SIAE:**
   - Click "SCARICA SIAE"
   - Dovrebbe scaricare un CSV

---

## 🔧 Troubleshooting

### **❌ Errore: "XLSX is not defined"**
- **Causa:** XLSX.js non ha caricato
- **Soluzione:** 
  - Controlla che la CDN sia accessible: apri F12 → Network
  - Se no, scarica XLSX.js localmente e aggiorna il path

### **❌ Errore: "Excel file non trovato"**
- **Causa:** Il file Excel non è nel percorso corretto
- **Soluzione:**
  - Verifica che esista: `C:\...\Excel\Borderò - ver 13.1.69_con AutoHotkey da sistemare.xlsm`
  - Se no, posizionalo nella cartella `/Excel/`
  - I dati comunque caricheranno dalle CSV locali

### **❌ Tabella vuota**
- **Causa:** I CSV non hanno dati
- **Soluzione:**
  - Controlla che `./data/brani.csv` abbia dati
  - Apri F12 → Console → Vedi i log
  - Se necessario, popola manualmente i CSV

### **❌ Port 8000 già in uso**
- **Causa:** Un altro processo usa la porta 8000
- **Soluzione:**
  ```powershell
  # Usa una porta diversa
  python -m http.server 8001
  # Poi accedi a: http://localhost:8001/Bordero/
  ```

### **❌ CORS Error**
- **Causa:** Browser bloccato da restrizioni
- **Soluzione:**
  - Assicurati di usare `http://localhost` (non `file://`)
  - Il server deve essere avviato

---

## 🎯 Flusso di Utilizzo Standard

```
1. Apri http://localhost:8000/Bordero/pages/bordero.html
   ↓
2. Seleziona DJ e Location dai dropdown
   ↓
3. Ricerca/Filtra brani con search box
   ↓
4. Click su brano per marcare come "Eseguito"
   ↓
5. Apri http://localhost:8000/Bordero/pages/next-coreo.html su SECONDO MONITOR
   (mostra prossimo brano in tempo reale)
   ↓
6. Apri http://localhost:8000/Bordero/pages/display.html su MONITOR SECONDARIO
   (tabella live per DJ)
   ↓
7. Quando finito: click "FINISCI SERATA" → vai a lista-serata.html per report
   ↓
8. Vedi statistiche su risultati.html
```

---

## 💾 Dati e Persistenza

- **Sincronizzazione Excel:** Accade automaticamente al caricamento di bordero.html
- **Cache localStorage:** I dati rimangono anche se chiudi il browser
- **Nuova Serata:** Tutte le serate partono con dati puliti
- **Archivio:** Le serate completate vengono archiviate con timestamp

---

## 📝 File Importanti

```
Bordero/
├── index.html                        ← Home page
├── pages/
│   ├── bordero.html                 ← PRINCIPALE (tabella)
│   ├── next-coreo.html              ← Display fullscreen
│   ├── display.html                 ← Monitor secondario
│   ├── lista-serata.html            ← Report
│   ├── risultati.html               ← Statistiche
│   └── videoclip.html               ← Video player
├── js/
│   ├── excel-sync.js                ← Sincronizzazione Excel
│   ├── data-loader.js               ← Caricamento dati
│   ├── config.js                    ← Configurazione
│   └── utils.js                     ← Utilità
└── data/
    ├── brani.csv                    ← Brani (da Excel)
    ├── dBase.csv                    ← DJ (da Excel)
    └── comuni_italia.csv            ← Locations (da Excel)
```

---

## 🎉 Pronto!

✅ Segui una delle opzioni di avvio sopra  
✅ Apri http://localhost:8000/Bordero/  
✅ Inizia a usare il progetto!

Se qualcosa non funziona, controlla la console (F12) per errori specifici.

**Buon lavoro! 🚀**
