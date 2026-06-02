Add-Type -AssemblyName System.IO.Compression.FileSystem
$file = 'C:\Users\Luca\AppData\Local\Temp\tmp_excel_inspect.xlsm'
$zip = [System.IO.Compression.ZipFile]::OpenRead($file)
try {
    $paths = @('xl/worksheets/sheet1.xml','xl/drawings/drawing1.xml','xl/drawings/vmlDrawing1.vml','xl/drawings/_rels/drawing1.xml.rels','xl/activeX/activeX2.bin')
    foreach ($path in $paths) {
        $entry = $zip.GetEntry($path)
        if ($entry) {
            Write-Host "=== $path ==="
            if ($path -match '\.bin$') {
                $stream = $entry.Open(); $bytes = New-Object byte[] $entry.Length; $stream.Read($bytes,0,$bytes.Length)|Out-Null; $stream.Close();
                $text = [System.Text.Encoding]::ASCII.GetString($bytes)
                $matches = ($text -split '\x00') | Where-Object { $_ -match 'Start Video|start video|START VIDEO|Click|Macro|Sub|Call|CommandButton|OLEObject|object|ActiveX|btn|Caption|Text' }
                $matches | Select-Object -Unique | ForEach-Object { Write-Host $_ }
            } else {
                $stream = $entry.Open(); $reader = New-Object System.IO.StreamReader($stream); $content = $reader.ReadToEnd(); $reader.Close(); $stream.Close();
                $content -split '\n' | Select-String 'Start Video|START VIDEO|start video|CommandButton|ole|activeX|Control|shape|Button|Macro|Sub|Click|green|Color' | Select-Object -First 200 | ForEach-Object { Write-Host $_ }
            }
        } else { Write-Host "Missing: $path" }
    }
} finally { $zip.Dispose() }
