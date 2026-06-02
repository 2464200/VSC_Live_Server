Add-Type -AssemblyName System.IO.Compression.FileSystem
$file = Get-ChildItem Excel -File | Select-Object -First 1 -ExpandProperty FullName
Write-Host "File: $file"
if (-not (Test-Path $file)) { Write-Host "File non trovato"; exit 1 }
$zip = [System.IO.Compression.ZipFile]::OpenRead($file)
try {
    foreach ($entry in $zip.Entries) {
        if ($entry.FullName -match 'vba|xl/worksheets|drawing|controls|objects|button|sheet|rels') {
            Write-Host $entry.FullName
        }
    }
} finally {
    $zip.Dispose()
}
