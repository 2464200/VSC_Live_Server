# Google Display Setup

1. Crea un nuovo Google Sheet chiamato `Display Mobile`.
2. Apri `Estensioni > Apps Script`, sostituisci il contenuto con `google-apps-script/mobile-display-api.gs` e salva.
3. In `Project Settings > Script properties`, aggiungi `MOBILE_DISPLAY_SECRET` con una stringa casuale di almeno 16 caratteri.
4. Seleziona `Deploy > New deployment > Web app`; esegui come proprietario e autorizza l'accesso a chiunque. Copia l'URL che termina in `/exec`.
5. Imposta URL e segreto nell'ambiente che avvia `unified-server.js`, seguendo `.env.google-display.example`.
6. Inserisci lo stesso URL in `public/mobile-google-config.js`. Non inserire il segreto nel file pubblico.
7. Riavvia il server. Il log deve riportare `[GOOGLE MOBILE] Bridge display attivo.`