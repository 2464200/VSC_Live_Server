$ErrorActionPreference = 'Stop'

$branch = (& git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
  Write-Warning 'Branch locale non disponibile: il deploy usera le copie public esistenti.'
} else {
  Write-Host "Branch locale: '$branch'. I file locali o diversi da origin saranno rinviati dalla sincronizzazione."
  & git fetch origin
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'Fetch origin non riuscito; procedo usando l ultimo riferimento remoto disponibile.'
  }
}

& firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
