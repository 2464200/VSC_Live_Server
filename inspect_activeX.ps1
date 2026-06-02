Add-Type -AssemblyName System.IO.Compression.FileSystem
$file = 'C:\Users\Luca\AppData\Local\Temp\tmp_excel_inspect.xlsm'
$zip = [System.IO.Compression.ZipFile]::OpenRead($file)
try {
    $entry = $zip.GetEntry('xl/activeX/activeX1.bin')
    if (-not $entry) { Write-Host 'Entry not found'; exit 1 }
    $stream = $entry.Open()
    $bytes = New-Object byte[] $entry.Length
    $stream.Read($bytes, 0, $bytes.Length) | Out-Null
    $stream.Close()
    $text = [System.Text.Encoding]::ASCII.GetString($bytes)
    $lines = $text -split '\x00'
    foreach ($line in $lines) {
        if ($line -match 'Start Video|start video|START VIDEO|Click|_Click|Macro|Sub|Call|CommandButton|OLEObject|Image|Text|Object') {
            Write-Host $line
        }
    }
} finally {
    $zip.Dispose()
}
