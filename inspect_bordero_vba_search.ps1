$null = [Reflection.Assembly]::LoadWithPartialName('System.IO.Compression')
$null = [Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem')
$file = Get-ChildItem -Path 'C:\VSC_Live_Server\Excel' -Filter '*.xlsm' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $file) { Write-Host "No xlsm file found"; exit 1 }
Write-Host "File: $($file.FullName)"

# Open file with shared read access in case Excel has it locked
$fs = [System.IO.File]::Open($file.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
$zip = $null
try {
    $zip = [System.IO.Compression.ZipArchive]::new($fs, [System.IO.Compression.ZipArchiveMode]::Read, $true)
    $entry = $zip.GetEntry('xl/vbaProject.bin')
    if (-not $entry) { Write-Host 'Missing xl/vbaProject.bin'; exit 1 }
    $stream = $entry.Open()
    $bytes = New-Object byte[] $entry.Length
    $stream.Read($bytes, 0, $bytes.Length) | Out-Null
    $stream.Close()
    $text = [System.Text.Encoding]::ASCII.GetString($bytes)
    $text = $text -replace '[\x00-\x1F]', ' '
    $patterns = @(
        'C:\\VSC_VIDEOCLIP', 'VSC_VIDEOCLIP', 'VideoClip', 'MatchAttivo', 'VerificaMatch', 'VerificaMatchN',
        'CaricaFileVideo', 'GetCartellaVideo', 'Worksheet_Change', 'Worksheet_SelectionChange', 'Intersect(',
        'A11:N612', 'A11:N613', 'A12:N612', 'A12:N613', 'A613', 'A612', 'Cells(', 'For Each cell In', 'xlUp'
    )
    foreach ($p in $patterns) {
        $idx = 0
        $found = $false
        while ($true) {
            $pos = $text.IndexOf($p, $idx, [System.StringComparison]::OrdinalIgnoreCase)
            if ($pos -lt 0) { break }
            $found = $true
            $start = [Math]::Max(0, $pos - 200)
            $end = [Math]::Min($text.Length, $pos + $p.Length + 200)
            Write-Host "=== $p @ $pos ==="
            Write-Host $text.Substring($start, $end - $start)
            Write-Host '---'
            $idx = $pos + $p.Length
        }
        if (-not $found) { Write-Host "=== $p NOT FOUND ===" }
    }
} finally {
    if ($zip) { $zip.Dispose() }
    $fs.Close()
}
