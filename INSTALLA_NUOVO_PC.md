# 📦 INSTALLA SU NUOVO PC - ISTRUZIONI RAPIDE

**Tempo totale:** 5 minuti  
**Difficoltà:** ⭐ Facile

---

## ✅ CHE COSA TI SERVE

Prima di iniziare, assicurati di avere:
- Windows 10 o superiore
- Connessione a Internet
- ~500 MB di spazio libero

**Nota:** Node.js e npm si installeranno automaticamente se mancano.

---

## 🚀 PASSO 1: SCARICA IL PROGETTO

1. **Scarica il file ZIP** dal repository
2. **Estrai la cartella** in una posizione comoda, esempio:
   ```
   C:\Monster_Country_DJ
   oppure
   C:\Progetti\Monster_Country_DJ
   ```

---

## ⚡ PASSO 2: AVVIA IL SERVER

### Modo più facile: Double-click
```
1. Vai nella cartella estratta
2. Trova il file: START-UNATTENDED.bat
3. Double-click su di esso
4. Aspetta 10-15 secondi
5. Il browser si aprirà automaticamente 🎉
```

### Se il doppio-click non funziona: Click destro → Esegui
```
1. Click destro su START-UNATTENDED.bat
2. Seleziona "Esegui come amministratore"
3. Clicca "Sì" se chiede permessi
4. Aspetta che il server si avvii
```

---

## 🌐 PASSO 3: ACCEDI ALL'APP

Quando il server è avviato, il browser si apre automaticamente all'indirizzo:
```
http://localhost:5500/
```

**Se il browser non si apre:**
```
Copia e incolla nel browser:
http://localhost:5500/
```

---

## ✅ PRIMO AVVIO: COSA ACCADE AUTOMATICAMENTE

Non devi fare nulla! Lo script fa tutto da solo:
- ✅ Scarica le dipendenze (npm install)
- ✅ Crea i file di configurazione
- ✅ Crea le cartelle necessarie
- ✅ Sceglie una porta libera
- ✅ Avvia il server

**Tutto automatico. Zero configurazione.**

---

## ⏹️ COME SPEGNERE IL SERVER

Quando hai finito di usare l'app:

### Modo 1: Chiudi la finestra PowerShell
```
Clicca sulla X della finestra nera che è rimasta aperta
```

### Modo 2: Usa il file STOP.bat
```
1. Apri la cartella del progetto
2. Double-click su STOP.bat
3. Il server si ferma
```

---

## ⚠️ PROBLEMI COMUNI

### "Porta 5500 occupata"
**Non è un problema!** Lo script sceglie automaticamente un'altra porta (5501, 5502, ecc.)  
Controlla quale porta è stata scelta nella finestra nera che si è aperta.

### "Server non risponde"
```
1. Apri il file: DIAGNOSTICA.bat
2. Ti mostrerà lo stato di tutto il sistema
3. Se vedi ❌ rossi, leggi il messaggio di errore
```

### "Pagina bianca nel browser"
```
1. Aspetta 5-10 secondi (il server potrebbe ancora avviarsi)
2. Premi F5 per ricaricare la pagina
3. Se persiste, esegui DIAGNOSTICA.bat
```

### "Errore di permessi / Accesso negato"
```
1. Click destro su START-UNATTENDED.bat
2. Seleziona "Esegui come amministratore"
```

---

## 📱 ACCESSO DA ALTRI DISPOSITIVI

Se vuoi accedere dalla app da un altro PC della stessa rete:

1. **Scopri l'IP del PC** (dalla finestra PowerShell all'avvio, cerca "Rete:")
   ```
   Esempio: http://192.168.1.100:5500/
   ```

2. **Da un altro PC sulla stessa rete:**
   ```
   Apri il browser e vai a:
   http://[IP_DEL_PC]:[PORTA]/
   
   Esempio: http://192.168.1.100:5500/
   ```

---

## 🎯 MODIFICA PORTA (Avanzato)

Se vuoi usare una porta diversa da 5500:

1. Apri il file: `.env` (con Blocco Note)
2. Trova: `UNIFIED_PORT=5500`
3. Cambia il numero, es: `UNIFIED_PORT=8080`
4. Salva il file
5. Riavvia il server

---

## ✨ SUCCESSO!

Se vedi la pagina web dell'app nel browser, **hai finito!** 🎉

Il server è online e pronto all'uso.

---

## 📞 SUPPORTO

Se riscontri problemi che non sono elencati sopra:

1. **Esegui DIAGNOSTICA.bat** per raccogliere info di sistema
2. **Cerca il messaggio di errore** nei logs:
   ```
   Cartella: logs\server-portable.log
   ```
3. **Contatta il supporto** con:
   - Output di DIAGNOSTICA.bat
   - Il messaggio di errore
   - Il contenuto di logs\server-portable.log

---

**Pronto? Inizia con PASSO 1! ⚡**

Per dettagli tecnici avanzati, vedi: [STARTUP_GUIDE.md](STARTUP_GUIDE.md)
