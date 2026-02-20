# 🚀 QUICK START - Avvia in 3 Passi

## 📝 SETUP (Prima volta - fai una volta sola)

Apri PowerShell in `C:\VSC_Live_Server` e esegui:

```powershell
cd C:\VSC_Live_Server
.\start-server-manager.ps1
```

✅ Attendi il messaggio: `✅ Server Manager avviato su porta 3000`

---

## ⚡ AVVIO (Ogni volta che usi il progetto)

**Finestra 1 - Avvia tutto insieme:**
```powershell
cd C:\VSC_Live_Server
.\launch-all.ps1
```

✅ Avvia:
- Live Server (porta 5500)
- Server Manager (porta 3000)
- PDF Server (auto-start quando richiesto)

**Output atteso:**
```
✅ Node.js trovato: v18.17.0
✅ npm trovato: 9.6.7
✅ Dipendenze già presenti
✅ Porta 5500 disponibile
✅ Porta 3000 disponibile
✅ Porta 8765 disponibile
✅ Live Server avviato su http://localhost:5500
✅ Server Manager avviato su http://localhost:3000
```

---

## 🌐 Apri nel Browser

Accedi a:

- **🏠 Home (Coreografie):**  
  http://localhost:5500/index.html

- **📊 Servizio corrente:**  
  http://localhost:5500/servizio2.html

- **📄 Gestione PDF (AUTO-START/AUTO-STOP!):**  
  http://localhost:5500/Prova/ScriptPDF1.html  
  ← **Apri questo! PDF Server si avvia automaticamente**

- **🔍 Diagnostica:**  
  http://localhost:5500/diagnostica.html

---

## ✨ Come Funziona Automaticamente

```
Apri ScriptPDF1.html
     ↓
Page loads → setupServerLifecycle() si esegue
     ↓
Contatta Server Manager (porta 3000)
     ↓
Server Manager avvia pdf-server.js (porta 8765)
     ↓
✅ Pagina carica e mostra i PDF
     ↓
Chiudi il tab
     ↓
beforeunload event → stopPdfServer()
     ↓
Server Manager ferma pdf-server.js
     ↓
✅ Porta 8765 libera, pronto per prossima volta
```

---

## 🛑 STOP (Quando finisci)

```powershell
.\stop-server-manager.ps1
```

✅ Output: `✅ Server Manager fermato`

Oppure Ctrl+C nella finestra PowerShell che esegue `launch-all.ps1`

---

## 🆘 Se Qualcosa Non Funziona

| Problema | Soluzione |
|----------|-----------|
| "Node.js non trovato" | Scarica da https://nodejs.org |
| "Porta 3000 occupata" | `.\stop-server-manager.ps1` poi riprova |
| "Server non si avvia" | Apri DevTools (F12) → Console → controlla errori |
| "Niente funziona" | `Get-Process node \| Stop-Process -Force` poi ricomincia da capo |

---

## 📚 Documentazione Completa

- **README_SERVER_MANAGER.md** - Architettura dettagliata e API reference
- **SOLUTION_SUMMARY.md** - Spiegazione completa della soluzione
- **QUICK_START.md** - Questo file (inizio rapido)

---

**✅ Pronto! Il PDF Server ora si avvia e si ferma automaticamente! 🎉**

---

## 📚 Documentazione

- **Setup dettagliato:** [README_SETUP_STABILE.md](README_SETUP_STABILE.md)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md)
- **Troubleshooting:** [README_SETUP_STABILE.md#troubleshooting](README_SETUP_STABILE.md)

---

## ✅ Verifiche prima di avviare

```powershell
# Node.js installato?
node --version

# npm ok?
npm --version

# Sei nella cartella giusta?
cd C:\VSC_Live_Server
```

---

**🎉 Happy coding!**
