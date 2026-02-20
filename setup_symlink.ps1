
# === Configura i percorsi qui se diverso ===
$Project = 'C:\VSC_Live_Server'
$Target  = 'C:\VIDEOCLIP'
$Link    = Join-Path $Project 'VIDEOCLIP'

Write-Host "===== Impostazione symlink ====="
Write-Host "Progetto : $Project"
Write-Host "Target   : $Target"
Write-Host "Link     : $Link"
Write-Host ""

# 1) Crea cartella progetto se non esiste
if (-not (Test-Path $Project)) {
  Write-Host "Creo cartella progetto: $Project"
  New-Item -ItemType Directory -Path $Project | Out-Null
}

# 2) Verifica privilegi Admin
$IsAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
  ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $IsAdmin) {
  Write-Host "Servono privilegi elevati per creare symlink (a meno di Developer Mode)."
  Write-Host "Rilancio lo script come Amministratore..."
  $argsLine = "-ExecutionPolicy Bypass -File `"$PSCommandPath`""
  Start-Process -FilePath "powershell.exe" -ArgumentList $argsLine -Verb RunAs
  exit
}

# 3) Se esiste gia' qualcosa in $Link, verifica che sia un symlink
if (Test-Path $Link) {
  $attrs = Get-Item $Link -Force
  if ($attrs.Attributes.ToString().ToLower().Contains('reparsepoint')) {
    Write-Host "Esiste gia' un collegamento: $Link -> $Target (presumo corretto)."
    Write-Host "OK."
    exit
  } else {
    Write-Host "ATTENZIONE: $Link esiste ma non e' un symlink. Non lo tocco."
    Write-Host "Rinomina o rimuovi manualmente e riesegui."
    exit 1
  }
}

# 4) Crea symlink
Write-Host "Creo symlink: $Link -> $Target"
New-Item -ItemType SymbolicLink -Path $Link -Target $Target | Out-Null
Write-Host "OK. Symlink pronto."
