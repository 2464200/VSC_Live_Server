> 📌 Questa documentazione fa parte della [guida unificata del progetto](README.md).

**⚠️ Nota importante:** a partire dal 13 Apr 2026 il flusso standard del progetto usa un unico unified-server.js su http://localhost:5500. Le architetture con server-manager.js, pdf-server.js, simple-server.js, static-server.js, pdf-server-simple.js e le porte 3000, 3010, 8765 sono ora legacy/historiche e non fanno parte del percorso standard.

# Eventi - Installazione e Uso in Rete Locale

## Obiettivo
Creare una rete Wi-Fi locale chiusa su cui far connettere fino a 10 DJ con notebook o tablet.
Il server Eventi resta sul PC principale collegato fisicamente al router.

---

## Componenti necessari

- PC server con il progetto in `c:\VSC_Live_Server`
- Router Wi-Fi o access point separato
- Notebook / tablet dei DJ collegati alla stessa rete Wi-Fi
- Node.js installato sul PC server

---

## Software da installare sul PC server

1. Node.js (versione LTS)
   - Scarica da: https://nodejs.org/
   - Installa con i valori predefiniti

2. Dipendenze del progetto
   - Apri PowerShell in `c:\VSC_Live_Server`
   - Esegui:
     ```powershell
     npm install
     ```

---

## Avvio del server Eventi

1. Apri PowerShell in `c:\VSC_Live_Server`
2. Esegui il comando:
   ```powershell
   npm start
   ```
3. Se tutto funziona, il server ascolta su porta `5500`.

Dovresti vedere in console qualcosa come:
- `ðŸ“ Server: http://localhost:5500`
- `ðŸ“ Rete: http://<IP-del-server>:5500`
- `ðŸ“Œ Eventi: http://<IP-del-server>:5500/eventi/eventi.html`

---

## Configurazione router / rete Wi-Fi locale

Il router deve creare una rete locale senza accesso a Internet.

### Vodafone Station Revolution: configurazione consigliata

Se usi una Vodafone Station Revolution, segui questi passi per garantire la stabilitÃ  della rete tra il PC server e tutti i DJ:

1. Apri il browser sul PC server e vai a:
   - `http://192.168.1.1` oppure `http://192.168.0.1`
2. Effettua il login con le credenziali del router (di solito scritte sul lato inferiore del dispositivo o sul manuale). Se non le hai, usa quelle predefinite e poi cambiale.
3. Vai alla sezione `Impostazioni Wi-Fi` o `Wireless`.
4. Crea una rete dedicata per l'evento:
   - SSID: scegli un nome chiaro come `EVENTI-DJ` o `EventiLocal`.
   - ModalitÃ  di sicurezza: `WPA2-PSK` o `WPA2/WPA3` se disponibile.
   - Password: imposta una password semplice da comunicare ai DJ ma lunga abbastanza da essere sicura.
5. Su `Banda` usa preferibilmente `2.4 GHz` se ci sono dispositivi piÃ¹ vecchi; se tutti i dispositivi supportano bene il 5 GHz, puoi attivare anche la seconda banda.
6. Seleziona un canale Wi-Fi fisso (es. `1`, `6`, `11` per 2.4 GHz) oppure lascia `Auto` solo se il router Ã¨ in grado di scegliere un canale non disturbato.
7. Disabilita la `Rete ospite` per i DJ. La rete degli DJ deve essere una rete interna normale, non una rete guest isolata.
8. Cerca e disabilita qualsiasi impostazione `AP Isolation / Client Isolation / Wireless Isolation`: deve essere disattivata perchÃ© i dispositivi devono comunicare con il PC server.
9. Se possibile, imposta DHCP sul router per assegnare automaticamente gli IP. Puoi anche riservare un IP statico per il PC server:
   - Esempio: `192.168.1.10` o `192.168.0.10`
10. Collega il PC server al router con cavo Ethernet, se puoi, per maggiore stabilitÃ .
11. Salva le impostazioni e riavvia il router se richiesto.

#### Controlli di stabilitÃ 

- Assicurati che il PC server e i dispositivi DJ siano sulla stessa subnet (es. `192.168.1.x` o `192.168.0.x`).
- Non usare la modalitÃ  `Bridge` o `Modem only` se il router deve gestire la Wi-Fi e il DHCP.
- Se hai problemi solo con alcuni dispositivi, prova a connetterli prima uno alla volta e verifica l'IP assegnato.

### Opzioni consigliate

- Metti il router in modalitÃ  hotspot locale o access point
- Disabilita il forwarding Internet se vuoi solo rete interna
- Assicurati che il PC server e i dispositivi siano sulla stessa subnet
- Se possibile, abilita DHCP nel router in modo che tutti ricevano un IP automaticamente

### Controlla l'IP del PC server

Sul PC server, esegui in PowerShell:
```powershell
ipconfig
```
Cerca l'indirizzo IPv4 della scheda Wi-Fi o Ethernet connessa al router.

L'URL di accesso sarÃ :
```text
http://<IP-del-server>:5500/eventi/eventi.html
```

---

## Pagina QR per accesso rapido

Sul PC server devi aprire una delle due pagine:

- `http://localhost:5500/eventi/qr.html`
- oppure `http://<IP-del-server>:5500/eventi/qr.html`

La pagina mostra un QR code e il link diretto da usare.

### Dove trovare il pulsante QR

- sulla home principale del server (`index.html`) Ã¨ presente il pulsante `QR Eventi`
- sulla pagina principale Eventi (`eventi.html`) Ã¨ presente lo stesso pulsante

---

## Come si collega un DJ

I DJ devono fare cosÃ¬:

1. Connettersi alla rete Wi-Fi evento creata dal router
2. Aprire il browser sul notebook/tablet
3. Scansionare il QR code mostrato sul PC server
4. Aprire il link ricevuto, che sarÃ :
   ```text
   http://<IP-del-server>:5500/eventi/eventi.html
   ```
5. Selezionare il proprio nome DJ dal menu in alto
6. Usare le azioni di prenotazione / esecuzione

---

## Comportamento in tempo reale

- Quando un DJ prenota un brano, lo stato viene salvato sul server
- Gli altri dispositivi vedono l'aggiornamento in tempo reale grazie a SSE
- Se un browser non supporta SSE, la pagina continua a usare polling automatico

---

## Consigli per l'uso live

- Lascia il PC server collegato con cavo al router se possibile
- Usa un router stabile e con buon segnale Wi-Fi
- Se i tablet/notebook non trovano il server, verifica l'IP e la connessione alla stessa rete
- Non servono router internet: basta rete locale

---

## Ripristino e test

1. Avvia il server con `npm start`
2. Apri `http://localhost:5500/eventi/qr.html`
3. Scansiona il QR con un telefono
4. Verifica che il browser apra `http://<IP>:5500/eventi/eventi.html`
5. Prova a prenotare un brano da un dispositivo
6. Controlla che gli altri dispositivi vedano l'aggiornamento entro pochi secondi

---

## Diagramma di rete

Esempio di topologia:

```text
[PC SERVER]
      |
      | cavo Ethernet (consigliato)
      |
   [ROUTER / ACCESS POINT]
      /  |  \
     /   |   \
[DJ1] [DJ2] [DJ3]
(notebook/tablet in Wi-Fi)
```

- Il `PC SERVER` ospita `npm start` e serve `http://<IP-server>:5500`
- Il `ROUTER` crea la Wi-Fi locale a cui si collegano i DJ
- I `DJ` aprono il link o scansionano il QR per raggiungere la pagina Eventi

## Nota finale

Il router non deve avere accesso a Internet per funzionare. L'importante Ã¨ che tutti i dispositivi stiano sulla stessa rete locale del PC server.



