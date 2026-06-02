Add-Type -AssemblyName System.IO.Compression.FileSystem
$file = 'C:\Users\Luca\AppData\Local\Temp\tmp_excel_inspect.xlsm'
$zip = [System.IO.Compression.ZipFile]::OpenRead($file)
try {
    $zip.Entries | Select-Object -Property FullName | Sort-Object -Property FullName | ForEach-Object { Write-Host $_.FullName }
} finally {
    $zip.Dispose()
}
