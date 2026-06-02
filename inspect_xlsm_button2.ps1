Add-Type -AssemblyName System.IO.Compression.FileSystem
$file = 'C:\Users\Luca\AppData\Local\Temp\tmp_excel_inspect.xlsm'
$tmp = 'C:\Users\Luca\AppData\Local\Temp\excel_inspect'
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Path $tmp | Out-Null
$zip = [System.IO.Compression.ZipFile]::OpenRead($file)
try {
    $wanted = @(
        'xl/worksheets/sheet1.xml',
        'xl/drawings/drawing1.xml',
        'xl/drawings/vmlDrawing1.vml',
        'xl/drawings/_rels/drawing1.xml.rels',
        'xl/activeX/activeX1.bin',
        'xl/activeX/activeX2.bin'
    )
    foreach ($entry in $zip.Entries) {
        if ($entry.FullName -in $wanted) {
            $out = Join-Path $tmp $entry.FullName
            $dir = Split-Path $out
            if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
            $stream = $entry.Open()
            $bytes = New-Object byte[] $entry.Length
            $stream.Read($bytes, 0, $bytes.Length) | Out-Null
            $stream.Close()
            [System.IO.File]::WriteAllBytes($out, $bytes)
        }
    }
} finally {
    $zip.Dispose()
}

Get-ChildItem $tmp -Recurse -File | ForEach-Object {
    Write-Host "=== $($_.FullName) ==="
    if ($_.Extension -eq '.bin') {
        $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
        $text = [System.Text.Encoding]::ASCII.GetString($bytes)
        $text -split '[\x00\x0A\x0D]' |
            Select-String 'Start Video|START VIDEO|start video|Caption|CommandButton|_Click|Macro|oleObject|ActiveX|Button|Click|BackColor|ForeColor|RGB|green' |
            Select-Object -Unique | ForEach-Object { Write-Host $_.Line }
    } else {
        Select-String -Path $_.FullName -Pattern 'Start Video|START VIDEO|start video|CommandButton|oleObject|activeX|ActiveX|Control|shape|Button|Macro|Sub|Click|green|Color|Caption|FmlaMacro' |
            ForEach-Object { Write-Host $_.Line }
    }
}
