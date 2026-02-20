# Script PowerShell per generare la lista dei file PDF da C:\SCRIPT_PDF
# Questo script deve essere eseguito periodicamente per mantenere aggiornata la lista

$pdfFolderPath = "C:\SCRIPT_PDF"
$outputPath = "$PSScriptRoot\Prova\pdf-list.json"

# Verifica se la cartella esiste
if (-not (Test-Path $pdfFolderPath)) {
    Write-Host "La cartella $pdfFolderPath non esiste. Creazione della cartella..."
    New-Item -ItemType Directory -Path $pdfFolderPath -Force | Out-Null
}

# Ottieni la lista dei file PDF
$pdfFiles = Get-ChildItem -Path $pdfFolderPath -Filter "*.pdf" -File | Sort-Object Name

# Crea l'array di oggetti per il JSON
$filesList = @()
foreach ($file in $pdfFiles) {
    $filesList += @{
        name = $file.Name
        path = $file.FullName
        size = [math]::Round($file.Length / 1MB, 2)
        created = $file.CreationTime.ToString("yyyy-MM-dd HH:mm")
    }
}

# Crea l'oggetto JSON
$jsonObject = @{
    timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    folderPath = $pdfFolderPath
    totalFiles = $filesList.Count
    files = $filesList
}

# Converte in JSON e salva
$jsonContent = $jsonObject | ConvertTo-Json -Depth 10
$jsonContent | Out-File -FilePath $outputPath -Encoding UTF8 -Force

Write-Host "Lista PDF aggiornata: $outputPath"
Write-Host "Totale file trovati: $($filesList.Count)"
