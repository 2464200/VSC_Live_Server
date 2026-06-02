$file = Get-ChildItem Excel -File | Select-Object -First 1 -ExpandProperty FullName
Write-Host "File: $file"
if (-not (Test-Path $file)) { Write-Host "File not found"; exit 1 }
$contents = tar -tf $file
$contents | Select-String 'vba|xl/worksheets|drawing|controls|objects|button|sheet' | Select-Object -First 200
