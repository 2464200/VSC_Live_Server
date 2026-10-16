# Regole generali del progetto

Queste regole si applicano a tutte le pagine e a tutti i moduli del progetto.

## Persistenza delle scelte dell'utente

- Ogni scelta dell'utente deve essere persistente: resta valida fino a quando l'utente la modifica o la azzera esplicitamente.
- Salvare ogni nuova scelta valida, sostituendo il valore precedente. Il nuovo valore diventa la scelta persistente da ripristinare agli accessi successivi.
- Ripristinare le scelte dopo ricaricamento, navigazione, chiusura e riapertura della pagina o dell'applicazione. Aggiornamenti dei dati e sincronizzazioni devono preservare le scelte ancora valide.
- La regola comprende campi compilati, selezioni, checkbox, opzioni radio, filtri, ordinamenti, dimensioni, modalità di visualizzazione e altre preferenze dell'interfaccia.
- Considerare validi anche `false`, `0` e una stringa vuota intenzionale. Applicare i valori predefiniti solo quando manca una scelta salvata o questa non è più valida per i dati disponibili.
- Un comando esplicito di pulizia o ripristino deve aggiornare anche lo stato persistente, così che la scelta precedente non ricompaia alla riapertura.
- Riutilizzare il sistema di persistenza già adottato dal modulo interessato.
- Ripristinare valori e selezioni senza rieseguire automaticamente azioni come pubblicazione, riproduzione, invio o cancellazione.
- Quando si modifica un'interfaccia, verificare che le scelte si conservino alla riapertura e che una successiva variazione sostituisca correttamente quella precedente.
