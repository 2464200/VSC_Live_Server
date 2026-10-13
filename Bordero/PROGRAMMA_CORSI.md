# Programma Coreografie Corsi

Apri **Programma Coreografie Corsi** dalla Home Borderò oppure **Gestisci programma corsi** nel tabellone.

1. Crea l'anno accademico, per esempio `2026/2027`. Il primo programma diventa automaticamente la stagione attiva.
2. Inserisci livello, settimana (1–52) e coreografia dal catalogo. Sono consentite fino a tre coreografie per settimana e livello; una coreografia può comparire una sola volta nel programma dello stesso livello.
   Nel campo coreografia puoi digitare l'ID o parte del nome e scegliere uno dei suggerimenti. Un ID completo (anche senza gli zeri iniziali) o un nome completo univoco vengono riconosciuti direttamente.
3. Usa **Modifica** per cambiare settimana, livello o coreografia e **Rimuovi** per eliminare una riga.
4. Per cambiare stagione nel tabellone, seleziona il programma e premi **Imposta stagione attiva**. Le altre stagioni restano disponibili come archivio.

Nel tabellone, **Livello del corso** limita l'elenco al programma della stagione attiva. **Insegnate fino alla settimana** include tutte le settimane dalla prima a quella scelta. I filtri e la ricerca si applicano anche a questo elenco. **Tutto il catalogo** e il reset dei filtri ripristinano l'elenco completo.

La colonna **SETTIMANA**, tra **INFO LIVELLO** e **INFO COREO 1**, riporta le settimane della stagione attiva. Se una coreografia è prevista in più livelli, mostra tutte le settimane distinte; con un livello corso selezionato mostra quelle di quel livello. Passando il mouse sul dato puoi leggere il dettaglio per livello. Il trattino indica una coreografia non prevista nel programma.

Clicca sull'intestazione **SETTIMANA** per ordinare prima in modo crescente e poi decrescente; il doppio click annulla il riordino, come per le altre colonne. Il pulsante **SETTIMANA** nei comandi filtri permette di scegliere una settimana esatta e si combina con i filtri già previsti dal tabellone. La ricerca generale include le settimane. La priorità NEXT e la modalità eseguiti in fondo si applicano anche al riordino per settimana.

In **Programma della stagione**, i pulsanti **SETTIMANA**, **LIVELLO**, **ID** e **COREOGRAFIA** riordinano l'elenco: il primo click sul criterio ordina in modo crescente, il successivo in modo decrescente. La freccia indica l'ordine applicato. All'apertura e al cambio di stagione la lista è ordinata per settimana decrescente. L'esportazione CSV conserva sempre il programma completo della stagione.

## CSV

Tutti i CSV della sezione usano la cartella locale `VSC_PROGRAMMA`, accanto alla cartella del progetto: con l'installazione in `C:\VSC_Live_Server` il percorso è `C:\VSC_PROGRAMMA`. La cartella viene creata automaticamente. Per personalizzarla su un PC imposta `VSC_PROGRAMMA_DIR` nel suo `.env`; sono accettati percorsi assoluti o relativi alla cartella del progetto, per esempio `../VSC_PROGRAMMA`.

Nell'app Electron, **Seleziona programma CSV**, **Esporta CSV** e **Scarica modello CSV** aprono il dialogo file nella cartella programma. Nel browser servito dall'app locale, la selezione mostra i CSV nella stessa cartella e le esportazioni vengono salvate lì; **Altra cartella…** consente di scegliere un CSV diverso. La sostituzione di un file esistente richiede conferma. Se apri la pagina da un sito remoto, i salvataggi usano invece la cartella di download del browser. Dopo aver aggiornato l'app, riavviala per attivare i nuovi gestori file.

Scarica il modello dalla pagina per ottenere esempi con ID effettivamente presenti nel catalogo. Sono accettati separatori virgola e punto e virgola.

```csv
anno_accademico,livello,settimana,brano_id
2026/2027,BASE,1,001
2026/2027,INTERMEDIO,2,002
```

Conserva gli zeri iniziali negli ID quando modifichi il CSV con Excel. Ogni file deve contenere una sola stagione. Tutte le righe vengono validate prima del salvataggio; l'importazione di una stagione esistente richiede conferma perché ne sostituisce il programma. **Esporta CSV** permette di conservare una copia della stagione selezionata.

## Sincronizzazione

Le modifiche sono salvate nel browser e inviate a Firebase quando è disponibile un account Google autorizzato. Se l'invio fallisce, restano in attesa anche dopo la riapertura della pagina; dopo l'accesso premi **Sincronizza programma**. Gli aggiornamenti ricevuti non sostituiscono le stagioni con modifiche locali in attesa. Le altre pagine dello stesso browser ricevono le modifiche subito; gli altri PC controllano gli aggiornamenti ogni 45 secondi.

Il percorso Realtime Database è `bordero/dance_curriculum`; le regole in `database.rules.json` autorizzano la scrittura agli account già previsti per Borderò. Dopo una modifica alle regole, pubblicale con `npm run deploy:database`: il comando `deploy:firebase` pubblica solo il sito Hosting e non aggiorna i permessi del database. Senza le regole del programma pubblicate, Firebase restituisce `PERMISSION_DENIED` e le modifiche restano locali. Dopo la correzione premi **Sincronizza programma** per inviarle. La pagina non pubblica lo stato della serata o del display. Il sito pubblico per i ballerini continua a essere generato con la sola pagina DISPLAY.
