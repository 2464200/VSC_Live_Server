# Fix PDF Server & Viewers - 9 Aprile 2026

## Problemi Risolti

### 1. ✅ Endpoint Mancanti
- **Prima**: `/api/health` non esisteva → Server non poteva essere verificato
- **Dopo**: Aggiunto endpoint `/api/health` che ritorna lo stato del server
- **Prima**: `/api/pdf-log-tail` non esisteva → Log non potevano essere visualizzati
- **Dopo**: Aggiunto sistema di logging interno del server con `/api/pdf-log-tail`

### 2. ✅ URL Inconsistenti
- **Prima**: Client usava `http://localhost:8765`, Server rispondeva su `http://127.0.0.1:8765`
- **Problema**: Potrebbe causare CORS issues, timeouts intermittenti
- **Dopo**: Tutti i client normalizzati a usare `http://127.0.0.1:8765`

**File aggiornati:**
- `ScriptPDF1.html`: `window.PDF_SERVER_HOST = 'http://127.0.0.1:8765'`
- `pdf-viewer.html`: `const PDF_SERVER_HOST = 'http://127.0.0.1:8765'`

### 3. ✅ Timeout Fragile
- **Prima**: Timeout fisso 3 secondi per `/api/health` check
- **Problema**: Timeout troppo breve causa false negatives
- **Dopo**: 
  - Timeout aumentato a 8 secondi (configurabile via `window.PDF_SERVER_TIMEOUT`)
  - Implementato retry logic con backoff esponenziale
  - Max 2 tentativi con attesa di 500ms, 1000ms tra i tentativi

**Benefici:**
- Connessioni intermittenti non fanno fallire
- Retry automatico aumenta affidabilità
- Tempo di attesa fra retry evita flood

### 4. ✅ Migliorato Error Handling
- **Prima**: Messaggi di errore generici ("Server non raggiungibile")
- **Dopo**: 
  - Ogni tentativo di connessione è loggato
  - Differenziazione fra timeout e altri errori
  - Messaggi descrittivi nel debug console

### 5. ✅ Aggiunto Supporto ESC in Viewer
- **Prima**: Solo pulsante X per chiudere
- **Dopo**: Tasto ESC chiude il viewer (migliore UX)

### 6. ✅ Content-Type Consistency
- Aggiunto `res.setHeader('Content-Type', 'application/json')` su `/api/health` e `/api/pdf-log-tail`

---

## Configurazione Corrette

### Server PDF
```bash
node pdf-server.js
# Output: ✅ Server PDF avviato su http://127.0.0.1:8765
```

### Client Configuration
```javascript
// ScriptPDF1.html
window.PDF_SERVER_HOST = 'http://127.0.0.1:8765';  // ✅ Corretto
window.PDF_SERVER_TIMEOUT = 8000;                   // 8 sec timeout
window.PDF_SERVER_RETRIES = 2;                      // 2 tentativi
```

### Endpoint Disponibili
- `GET /api/health` - Verifica server (ritorna stato + info)
- `GET /api/pdf-list` - Lista PDF
- `POST /api/open-pdf` - Apre PDF in Chrome
- `GET /api/serve-pdf` - Serve PDF via HTTP
- `GET /api/monitor-info` - Info monitor
- `POST /api/close-chrome` - Chiude Chrome
- `GET /api/pdf-log-tail` - Ultimi log server
- `GET /api/opened-viewers` - Viewer aperti

---

## Testing

### 1. Verificare Connessione Server
```bash
curl http://127.0.0.1:8765/api/health
# Ritorna: {"success":true,"message":"PDF Server is alive",...}
```

### 2. Verificare Lista PDF
```bash
curl http://127.0.0.1:8765/api/pdf-list
# Ritorna: {"success":true,"files":[...],...}
```

### 3. Test Pagina
- Apertura: `http://127.0.0.1:8765/Prova/ScriptPDF1.html`
- Dovrebbe mostare: "Server pronto - X PDF disponibili"
- Se fallisce: Controlla console browser (F12 > Console)

---

## Possibili Problemi Rimasti

### Problema: "Server non raggiungibile"
**Diag:**
1. Apri browser console (F12 > Console)
2. Verifica che il server sia davvero avviato
3. Controlla che non ci siano firewall bloccando porta 8765
4. Prova: `http://127.0.0.1:8765/api/health` direttamente nel browser

### Problema: "Timeout anche dopo fix"
**Diag:**
1. Aumenta `window.PDF_SERVER_TIMEOUT` a 12000 (12 sec)
2. Controlla velocità di rete
3. Controlla CPU/RAM del server

### Problema: Chrome non si apre
**Diag:**
1. Controlla che Chrome sia installato
2. Verifica console del server per messaggi di errore
3. Prova `/api/monitor-info` per determinare monitor secondario

---

## File Modificati (9 Aprile 2026)

| File | Cambiamenti | Motivo |
|------|------------|--------|
| `pdf-server.js` | +endpoint `/api/health`, `/api/pdf-log-tail`, logging | Aggiunto diagnostica server |
| `ScriptPDF1.html` | Timeout 3→8s, retry logic, URL localhost→127.0.0.1 | Stabilità connessione |
| `pdf-viewer.html` | URL localhost→127.0.0.1, ESC handler, closePdfViewer() | Consistenza + UX |

---

## Note di Deployment

✅ **Tutti i fix sono compatibili verso il basso**
- Nessun breaking change
- Server vecchi continueranno a funzionare
- Se non si usa `/api/health`, non influisce

✅ **Pronto per produzione**
- Supporta retry + timeout robusti
- Logging migliorato per diagnostica
- Error handling completo

---

**Data**: 9 Aprile 2026
**Status**: ✅ STABILE E TESTATO
