$ErrorActionPreference = 'Stop'

$branch = (& git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
  Write-Warning 'Branch locale non disponibile: il deploy usera le copie public esistenti.'
} else {
  Write-Host "Branch locale: '$branch'. Il codice non allineato resta rinviato; i CSV condivisi aggiornati localmente saranno sincronizzati."
  & git fetch origin
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'Fetch origin non riuscito; procedo usando l ultimo riferimento remoto disponibile.'
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$firebaseCli = Join-Path $repoRoot 'node_modules\firebase-tools\lib\bin\firebase.js'
if (-not (Test-Path $firebaseCli)) {
  Write-Host 'Firebase CLI locale assente. Installo le dipendenze del progetto...' -ForegroundColor Yellow
  Push-Location $repoRoot
  try {
    & npm install --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } finally {
    Pop-Location
  }
}

& node $firebaseCli deploy --only hosting
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
