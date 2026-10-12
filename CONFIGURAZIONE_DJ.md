# Configurazione locale Bordero per DJ e PC

## Come funziona

Ogni installazione usa la configurazione locale del proprio PC. Non viene scelto un profilo tramite il campo DJ della serata: quel campo identifica il DJ dell'evento, mentre i percorsi dei file e le preferenze di monitor appartengono alla macchina su cui gira l'applicazione. Questa scelta evita che una selezione di DJ cambi i percorsi locali mentre Bordero o i server sono in uso.

I file runtime locali sono salvati in `.local/` nella cartella principale del progetto. La cartella è ignorata da Git; non va copiata da un PC a un altro. Le impostazioni generali, i dati condivisi e il codice restano nei percorsi gestiti dal progetto.

## Configurazioni personali

| Impostazione | File o posizione | Note |
| --- | --- | --- |
| Cartella dell'archivio musicale | `.local/bordero/music-archive-local-config.json` | Impostata da ADMIN; percorso assoluto specifico del PC. |
| Indice/cache dell'archivio musicale | `.local/bordero/music-archive-index.csv` | Contiene anche i percorsi assoluti dei brani; viene generato localmente e non va condiviso. |
| Cartella VideoClip | `.local/bordero/video-clip-local-config.json` | Impostata da ADMIN; accetta percorsi assoluti o relativi alla cartella del progetto. Il valore predefinito `../VSC_VIDEOCLIP` punta a `C:\VSC_VIDEOCLIP`; se non configurato, usa `VSC_VIDEOCLIP_PATH` da `.env`. |
| Monitor primario e opzioni di visualizzazione | `.local/electron/monitor-preferences.json` | Configurata al primo avvio Electron e da ADMIN. |
| Instradamento delle pagine sui monitor | `.local/electron/page-policy.json` | Preferenze salvate tramite ADMIN/Electron. |
| Percorsi di PDF, esportazione SIAE, registrazioni, VLC e FFmpeg | `.env` | Variabili per PC già supportate dal progetto; usare `.env.example` come riferimento senza copiarne segreti. |
| Preferenze ADMIN già nel browser | `localStorage` del browser per il sito locale | Include, tra le altre, software DJ, scorrimento display e tipo di dati del visualizzatore. Rimane sul profilo browser locale e non è condivisa via Git. |

I file in `.local/` sono JSON leggibili e modificabili con un editor di testo. I percorsi relativi sono risolti dalla cartella principale del progetto; quelli assoluti restano disponibili per cartelle specifiche del PC. Un percorso VideoClip non valido viene ignorato e si applica il valore predefinito indicato sopra o nella schermata ADMIN.

## Impostazioni comuni lasciate invariate

Restano condivisi e gestiti come prima: logiche applicative, HTML/CSS/JavaScript, dati CSV comuni, sincronizzazione Excel/Google/Firebase, credenziali e collegamenti di progetto, configurazione dei servizi e contenuti predefiniti del display LED. Non inserire in `.local/` dati che devono essere condivisi tra le installazioni.

La cartella `Bordero/data/music-archive-config.json` rimane il valore di progetto per un percorso relativo condivisibile; non deve contenere percorsi personali assoluti. La configurazione locale dell'archivio musicale ha priorità su quel valore.

## Primo avvio o nuovo PC

1. Clonare o aggiornare il progetto normalmente.
2. Avviare il server/Electron. Al primo avvio, le configurazioni legacy presenti in `electron/`, `Bordero/data/*-local-config.json` e l'indice `Bordero/data/music-archive-index.csv` vengono copiate in `.local/` se non esiste già la nuova copia. I file originali non vengono cancellati dalla migrazione.
3. Aprire ADMIN e impostare/verificare i percorsi di archivio musicale e VideoClip.
4. Verificare la scelta del monitor primario quando Electron lo richiede.
5. Se necessario, creare `.env` partendo da `.env.example`, poi correggere i percorsi per quel PC. `.env` è ignorato da Git.

Per un nuovo DJ su un PC nuovo, non copiare `.local/` o `.env` da un'altra macchina. Creare le preferenze locali usando ADMIN e impostare i valori necessari in `.env`.

Il task VS Code `avviodaniele` controlla la porta 5500 prima di avviare il server. Se trova il server o la sessione Electron avviati dalla stessa copia del progetto, li arresta e li riavvia per applicare il codice e le configurazioni aggiornati. Se non riesce ad attribuire con certezza la porta al progetto corrente, si ferma senza terminare il processo estraneo.

## Verificare o modificare la configurazione attiva

- In ADMIN, controllare lo stato e i percorsi mostrati nelle sezioni Archivio Brani, VideoClip e Monitor.
- Esaminare `.local/bordero/` e `.local/electron/` per vedere i valori salvati. Le date `updatedAt` indicano l'ultimo salvataggio quando previste.
- Modificare i percorsi dalle relative schermate ADMIN, preferibilmente. Per `.env`, fermare e riavviare il server dopo la modifica.
- Per ripristinare una singola preferenza, correggerla in ADMIN o rimuovere il relativo file sotto `.local/`: al successivo avvio verrà usato il valore predefinito e la schermata potrà ricreare la configurazione.
- Per ripristinare tutte le preferenze locali, chiudere il progetto e rinominare `.local/` come backup; al successivo avvio verranno ricreati i valori predefiniti. Non cancellare il backup finché non si è verificato l'avvio.

## Aggiornamenti Git e pubblicazione

`.local/` e `.env` sono ignorati da Git, perciò `pull`, `merge` e `checkout` non trasferiscono i valori locali non tracciati. I vecchi percorsi `electron/monitor-preferences.json`, `electron/page-policy.json` e `Bordero/data/*-local-config.json` sono sorgenti di migrazione compatibili; il runtime nuovo scrive sotto `.local/` e non li aggiorna.

Per i file legacy che risultano ancora tracciati, l'aggiornamento può sostituire la copia legacy nel repository. La copia migrata in `.local/` resta quella attiva e non viene sovrascritta da Git. Se una macchina non ha ancora eseguito la migrazione, avviare una volta la nuova versione prima di ulteriori aggiornamenti e verificare che i file attesi esistano in `.local/`.

Eccezione da controllare durante la prima installazione: `Bordero/data/music-archive-config.json` era tracciato e conteneva un percorso assoluto. È stato azzerato per non distribuire il percorso personale. Se una macchina usava quel solo valore e non aveva `music-archive-local-config.json`, recuperare il vecchio percorso dal backup locale/Git prima di aggiornare e impostarlo da ADMIN dopo l'aggiornamento. La migrazione automatica copia il file locale dedicato, ma non può recuperare un valore già sostituito nel file tracciato.

Firebase Hosting pubblica `public/`, non `.local/` o `.env`. Lo script `sync-public` esclude i vecchi override locali dell'archivio e di VideoClip e rimuove dall'area pubblica il vecchio indice musicale, che conteneva percorsi assoluti.

## Limiti e scelte deliberate

Il progetto ha impostazioni generali con valori predefiniti Windows (per esempio `C:\VSC_SCRIPT_PDF` e `C:\VSC_SIAE`) e trova VLC/FFmpeg in posizioni comuni di installazione. Sono rimaste invariate perché possono rappresentare convenzioni condivise tra i PC e non è sempre possibile dedurne la natura personale dal solo percorso; dove previsto, `.env` consente l'override locale. Il percorso di archivio serate mostrato nella configurazione JavaScript non è stato cambiato: va chiarito se indica una cartella condivisa di lavoro prima di renderlo specifico per macchina.

La configurazione è per installazione/PC, non per identità del DJ. Se in futuro più DJ useranno lo stesso PC con periferiche o percorsi distinti, servirà una selezione esplicita di profilo e una specifica delle sole chiavi da separare.
