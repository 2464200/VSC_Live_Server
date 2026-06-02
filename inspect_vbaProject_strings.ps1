Add-Type -AssemblyName System.IO.Compression.FileSystem
$file = 'C:\Users\Luca\AppData\Local\Temp\tmp_excel_inspect.xlsm'
$zip = [System.IO.Compression.ZipFile]::OpenRead($file)
try {
    $entry = $zip.GetEntry('xl/vbaProject.bin')
    if (-not $entry) { Write-Host 'Missing xl/vbaProject.bin'; exit 1 }
    $stream = $entry.Open()
    $bytes = New-Object byte[] $entry.Length
    $stream.Read($bytes, 0, $bytes.Length) | Out-Null
    $stream.Close()
    $text = [System.Text.Encoding]::ASCII.GetString($bytes)
    $patterns = @('btnPlayX','btnStopVideo','Start Video','START VIDEO','PlayX','StopVideo','Play','Video','Click','_Click','Sub ','Function ','Property','Set ')
    foreach ($pattern in $patterns) {
        $lines = $text -split '[\x00\x0A\x0D]' | Where-Object { $_ -match [regex]::Escape($pattern) }
        if ($lines) {
            Write-Host "=== $pattern ==="
            $lines | Select-Object -Unique | ForEach-Object { Write-Host $_ }
            Write-Host
        }
    }
} finally {
    $zip.Dispose()
}
