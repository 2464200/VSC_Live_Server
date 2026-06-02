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
    $text = $text -replace '[\x00-\x1F]', ' '
    $patterns = @('btnPlayX_Click','vbGreen','BackColor','btnStopVideo_Click','PlayX','StopVideo')
    foreach ($pattern in $patterns) {
        $idx = $text.IndexOf($pattern, 0, [System.StringComparison]::OrdinalIgnoreCase)
        if ($idx -ge 0) {
            $start = [Math]::Max(0, $idx - 500)
            $end = [Math]::Min($text.Length, $idx + $pattern.Length + 500)
            $snippet = $text.Substring($start, $end - $start)
            Write-Host "=== $pattern @ $idx ==="
            Write-Host $snippet
            Write-Host
        }
    }
} finally {
    $zip.Dispose()
}
