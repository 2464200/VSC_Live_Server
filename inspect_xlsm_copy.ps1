Add-Type -AssemblyName System.IO.Compression.FileSystem
$file = Get-ChildItem Excel -File | Select-Object -First 1 -ExpandProperty FullName
$copy = Join-Path $env:TEMP 'tmp_excel_inspect.xlsm'
Copy-Item -Path $file -Destination $copy -Force
Write-Host "Copied to: $copy"
$zip = [System.IO.Compression.ZipFile]::OpenRead($copy)
try {
    foreach ($entry in $zip.Entries) {
        if ($entry.FullName -match 'vba|xl/worksheets|drawing|controls|objects|button|sheet|rels') {
            Write-Host $entry.FullName
        }
    }
} finally {
    $zip.Dispose()
}
