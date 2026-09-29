$ErrorActionPreference = 'Stop'

$branch = (& git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
  throw 'Impossibile determinare il branch locale; deploy annullato.'
}

$upstream = (& git rev-parse --abbrev-ref --symbolic-full-name '@{u}').Trim()
if ($LASTEXITCODE -ne 0 -or -not $upstream.StartsWith('origin/')) {
  throw "Il branch '$branch' non ha un upstream origin configurato; deploy annullato."
}

Write-Host "Aggiorno i riferimenti da origin per il branch '$branch'..."
& git fetch origin
if ($LASTEXITCODE -ne 0) {
  throw 'git fetch origin non riuscito; deploy annullato.'
}

$changes = @(& git status --porcelain)
if ($LASTEXITCODE -ne 0) {
  throw 'Impossibile verificare il working tree; deploy annullato.'
}
if ($changes.Count -gt 0) {
  Write-Host 'Il working tree contiene modifiche locali:' -ForegroundColor Yellow
  $changes | ForEach-Object { Write-Host "  $_" }
  throw 'Commit e sincronizza le modifiche prima del deploy.'
}

$counts = ((& git rev-list --left-right --count "HEAD...$upstream") -join '').Trim()
if ($LASTEXITCODE -ne 0) {
  throw "Impossibile confrontare il branch con '$upstream'; deploy annullato."
}
$aheadBehind = $counts -split '\s+'
if ($aheadBehind.Count -ne 2 -or $aheadBehind[0] -ne '0' -or $aheadBehind[1] -ne '0') {
  throw "Il branch '$branch' non e' allineato a '$upstream' (avanti/indietro: $counts). Sincronizzalo prima del deploy."
}

Write-Host "Branch '$branch' allineato a '$upstream'. Avvio deploy Firebase Hosting e predeploy..." -ForegroundColor Green
& firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}