# Impostazioni della singola macchina

Le impostazioni del PC restano separate dai dati condivisi del programma e della serata:

- La cartella CSV del Programma Coreografie deriva dalla posizione del progetto: `../VSC_PROGRAMMA`, quindi `C:\VSC_PROGRAMMA` con il progetto in `C:\VSC_Live_Server`. L'eventuale personalizzazione `VSC_PROGRAMMA_DIR` appartiene al `.env` di quel PC. Tutti i comandi CSV della sezione usano la stessa configurazione.
- La scelta **Giorno / Notte** in **ADMIN → Modalità monitor principale** viene conservata in `.local/bordero/ui-preferences.json`. Il valore iniziale è Notte; Giorno applica lo sfondo bianco e colori leggibili alle pagine della finestra principale. Notte ripristina gli stili originali.
- Electron identifica la finestra principale effettiva secondo le impostazioni monitor già esistenti. Display, player video e finestre temporanee del monitor secondario conservano i propri stili, anche se mostrano una pagina utilizzabile su entrambi i monitor.
- Tutte le pagine locali del monitor principale usano la larghezza disponibile, con lo stesso margine laterale adattivo del tabellone Borderò. La regola vale sia in modalità Giorno sia in modalità Notte, senza alterare il formato di stampa, i dialoghi o le dimensioni dei contenuti multimediali. Viene caricata dal preload Electron anche nelle pagine senza navigazione condivisa.

`.env` e `.local/` sono esclusi da Git; questa preferenza non viene inviata a Firebase e non viene inclusa nell'esportazione/importazione della cache ADMIN. Ogni installazione mantiene la sua scelta anche dopo riapertura dell'app o pulizia della cache del browser. Il sito pubblico DISPLAY viene generato separatamente e conserva il proprio aspetto.

Il browser locale e Electron leggono la stessa preferenza sul disco del PC. Per usare il controllo nel browser serve il server del progetto su localhost. Dopo l'aggiornamento, riavvia l'app Electron e il server locale per caricare i nuovi gestori.
