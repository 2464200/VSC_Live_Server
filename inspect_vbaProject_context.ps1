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
    $ascii = [System.Text.Encoding]::ASCII.GetString($bytes)
    $ascii = $ascii -replace '[\x00-\x1F]', ' '
    $patterns = @('btnPlayX_Click','btnStopVideo_Click','btnPlayX','btnStopVideo','BackColor','ForeColor','vbGreen','RGB(','Caption','Text','Enabled','Visible','Interior','DarkGreen','Green')
    foreach ($pattern in $patterns) {
        $idx = 0
        while ($true) {
            $idx = $ascii.IndexOf($pattern, $idx, [System.StringComparison]::OrdinalIgnoreCase)
            if ($idx -lt 0) { break }
            $start = [Math]::Max(0, $idx - 120)
            $end = [Math]::Min($ascii.Length, $idx + $pattern.Length + 200)
            $snippet = $ascii.Substring($start, $end - $start)
            Write-Host "=== $pattern @ $idx ==="
            Write-Host $snippet
            Write-Host
            $idx += $pattern.Length
        }
    }
} finally {
    $zip.Dispose()
}
