# Guida Git Operativa (main e develop)

Questa guida descrive il flusso consigliato per lavorare in sicurezza con due branch principali:
- `main`: produzione stabile
- `develop`: integrazione delle modifiche testate

## 1. Configurazione iniziale (una sola volta)

Verifica remote e branch:

```powershell
git remote -v
git branch -a
```

Aggiorna i riferimenti locali ai branch remoti:

```powershell
git fetch --all --prune
```

## 2. Cosa fanno add, commit, push, pull, fetch, merge

- `git add`: prepara file nello staging per il prossimo commit.
- `git commit`: crea uno snapshot locale versionato.
- `git push`: invia i commit locali al remoto (`origin`).
- `git fetch`: scarica aggiornamenti remoti senza cambiare il working tree locale.
- `git pull`: equivale a `fetch + merge` (o `fetch + rebase` se configurato).
- `git merge`: unisce la cronologia di un branch dentro un altro.

## 3. Flusso giornaliero consigliato

All'inizio della giornata:

```powershell
git checkout develop
git fetch --all --prune
git pull origin develop
```

Crea un branch di lavoro da `develop`:

```powershell
git checkout -b feature/nome-attivita
```

Durante lo sviluppo:

```powershell
git status
git add -A
git commit -m "feat: descrizione breve"
git push -u origin feature/nome-attivita
```

## 4. Aggiornare la versione locale con quella remota

### 4.1 Aggiornare solo riferimenti remoti (senza toccare file locali)

```powershell
git fetch --all --prune
```

Quando usarlo:
- vuoi vedere se `origin/main` o `origin/develop` sono avanzati
- non vuoi modificare subito il tuo working tree

Controlli utili dopo fetch:

```powershell
git log --oneline --decorate --graph --all -n 20
git status
```

### 4.2 Allineare il locale a `develop`

```powershell
git checkout develop
git fetch --all --prune
git pull origin develop
```

### 4.3 Allineare il locale a `main`

```powershell
git checkout main
git fetch --all --prune
git pull origin main
```

## 5. Portare una feature in develop

Quando la feature e' testata:

```powershell
git checkout develop
git pull origin develop
git merge --no-ff feature/nome-attivita
git push origin develop
```

Pulizia branch feature:

```powershell
git branch -d feature/nome-attivita
git push origin --delete feature/nome-attivita
```

## 6. Portare develop in main

Procedura consigliata:
- Pull Request da `develop` verso `main` su GitHub
- Review
- Merge PR solo dopo test verdi

Procedura da terminale (repo personale o team piccolo):

```powershell
git checkout main
git pull origin main
git merge --no-ff develop
git push origin main
```

## 7. Gestione conflitti durante pull o merge

Se Git segnala conflitti:

```powershell
git status
```

Poi:
- apri i file in conflitto
- risolvi i marker `<<<<<<<`, `=======`, `>>>>>>>`
- salva
- completa:

```powershell
git add -A
git commit
```

Nota: il commit finale di merge puo' avere messaggio automatico.

## 8. Comandi pratici per questo repository

Verifica veloce prima di commit:

```powershell
node test-system.js
git status
```

Staging completo (inclusi rinomini/cancellazioni):

```powershell
git add -A
```

Commit con messaggio chiaro:

```powershell
git commit -m "docs: aggiorna guide operative e workflow git"
```

Push del branch corrente:

```powershell
git push
```

## 9. Errori comuni da evitare

- Committare direttamente su `main` per modifiche non urgenti.
- Usare `git pull` senza sapere su quale branch sei (`git branch --show-current`).
- Dimenticare `git fetch --all --prune`, restando con riferimenti remoti obsoleti.
- Fare merge su `main` senza test minimi (`node test-system.js` + verifica pagine principali su `5500`).

## 10. Checklist finale prima del push

- branch corretto (`develop` o `feature/*`)
- working tree pulito o modifiche intenzionali
- test principali eseguiti
- messaggio commit chiaro
- push verso remoto corretto (`origin`)
