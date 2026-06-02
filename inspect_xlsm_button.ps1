Add-Type -AssemblyName System.IO.Compression.FileSystem
$file = 'C:\Users\Luca\AppData\Local\Temp\tmp_excel_inspect.xlsm'
$zip = [System.IO.Compression.ZipFile]::OpenRead($file)
try {
    $searchTerms = 'Start Video','START VIDEO','start video','CommandButton','oleObject','ActiveX','activeX','Control','Button','Macro','Sub','Click','green','Color','Caption','BackColor','ForeColor','RGB','LinkedCell'
    $paths = @(
        'xl/worksheets/sheet1.xml',
        'xl/drawings/drawing1.xml',
        'xl/drawings/vmlDrawing1.vml',
        'xl/drawings/_rels/drawing1.xml.rels',
        'xl/activeX/activeX1.bin',
        'xl/activeX/activeX2.bin'
    )
    foreach ($path in $paths) {
        $entry = $zip.GetEntry($path)
        if (-not $entry) { Write-Host "Missing: $path"; continue }
        Write-Host "=== $path ==="
        if ($path -match '\.bin$') {
            $stream = $entry.Open()
            $bytes = New-Object byte[] $entry.Length
            $stream.Read($bytes, 0, $bytes.Length) | Out-Null
            $stream.Close()
            $text = [System.Text.Encoding]::ASCII.GetString($bytes)
            $Fragments = $text -split '[\x00\x0A\x0D]'
            foreach ($term in $searchTerms) {
                $found = $Fragments | Where-Object { $_ -match [regex]::Escape($term) }
                if ($found) {
                    Write-Host "-- matches for '$term' --"
                    $found | Select-Object -Unique | ForEach-Object { Write-Host $_ }
                }
            }
        }
        else {
            $stream = $entry.Open()
            $reader = New-Object System.IO.StreamReader($stream)
            $content = $reader.ReadToEnd()
            $reader.Close(); $stream.Close()
            foreach ($line in $content -split '\n') {
                foreach ($term in $searchTerms) {
                    if ($line -match [regex]::Escape($term)) { Write-Host $line; break }
                }
            }
        }
        Write-Host
    }
} finally { $zip.Dispose() }
