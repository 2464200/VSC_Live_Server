
# Play-Videoclip.ps1
# Legge A1 da videoclip.csv, estrae le prime 3 cifre, cerca in C:\VIDEOCLIP
# un file che inizia con quel prefisso e lo apre col viewer predefinito.

param(
    [string]$CsvPath = $null,
    [string]$VideoFolder = "C:\VIDEOCLIP",
    [string[]]$Extensions = @('mp4','mov','mkv','avi','wmv','m4v','mpeg','mpg')
)

# 0) Determina il percorso del CSV
if (-not $CsvPath) {
    # prova videoclip.csv / Videoclip.csv nella stessa cartella dello script
    $candidates = @(
        (Join-Path $PSScriptRoot 'videoclip.csv'),
        (Join-Path $PSScriptRoot 'Videoclip.csv')
    )
    $CsvPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $CsvPath) {
    Write-Error "File 'videoclip.csv' non trovato nella cartella dello script. Specifica -CsvPath."
    exit 1
}
if (-not (Test-Path $CsvPath)) {
    Write-Error "CSV non esistente: $CsvPath"
    exit 1
}

# 1) Leggi la prima riga (A1 = prima cella della prima riga)
try {
    $firstLine = Get-Content -Path $CsvPath -TotalCount 1 -ErrorAction Stop
} catch {
    Write-Error "Impossibile leggere $CsvPath: $_"
    exit 2
}

# Rimuovi eventuale BOM (UTF-8)
$firstLine = $firstLine -replace '^\xEF\xBB\xBF',''

# Determina separatore ; o ,
$delimiter = ($firstLine -match ';') ? ';' : ','

# Estrai A1 e ripulisci apici/spazi
$A1 = ($firstLine -split $delimiter)[0].Trim('"').Trim()
if (-not $A1) {
    Write-Error "A1 vuota o non valida nel CSV ($CsvPath)."
    exit 3
}

# 2) Estrai le prime 3 cifre all'inizio di A1
$prefixMatch = [Regex]::Match($A1, '^\s*(\d{3})')
if (-not $prefixMatch.Success) {
    Write-Error "A1 non inizia con 3 cifre: '$A1'."
    exit 4
}
$prefix = $prefixMatch.Groups[1].Value
Write-Host "Prefisso trovato (prime 3 cifre di A1): $prefix"
Write-Host "Testo A1: $A1"

# 3) Controlla la cartella video
if (-not (Test-Path $VideoFolder)) {
    Write-Error "Cartella non trovata: $VideoFolder"
    exit 5
}

# 4) Cerca i file che iniziano con quelle 3 cifre, filtrando per estensioni note
try {
    $files = Get-ChildItem -Path $VideoFolder -File -ErrorAction Stop | Where-Object {
        # match inizio nome con prefisso
        $_.Name -match ("^" + [Regex]::Escape($prefix))
    } | Where-Object {
        $ext = $_.Extension.TrimStart('.').ToLower()
        $Extensions -contains $ext
    } | Sort-Object LastWriteTime -Descending
} catch {
    Write-Error "Errore nel leggere i file in $VideoFolder: $_"
    exit 6
}

if (-not $files -or $files.Count -eq 0) {
    Write-Error "Nessun file in '$VideoFolder' che inizi con '$prefix'."
    exit 7
}

# 5) Scegli il più recente e aprilo col viewer predefinito
$target = $files[0].FullName
Write-Host "Riproduzione con il visualizzatore predefinito: $target"
try {
    Invoke-Item -Path $target
} catch {
    Write-Error "Impossibile aprire il file: $_"
    exit 8
}
