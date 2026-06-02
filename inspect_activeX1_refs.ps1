Add-Type -AssemblyName System.IO.Compression.FileSystem
$file = 'C:\Users\Luca\AppData\Local\Temp\tmp_excel_inspect.xlsm'
$zip = [System.IO.Compression.ZipFile]::OpenRead($file)
$patterns = @('activeX1.xml','activeX1.bin','activeX1','activeX2.xml','activeX2.bin','activeX2')
try {
    foreach ($entry in $zip.Entries | Sort-Object FullName) {
        $name = $entry.FullName
        if ($name -match '\.xml$|\.rels$|\.bin$') {
            $stream = $entry.Open()
            $reader = New-Object System.IO.StreamReader($stream)
            $content = $reader.ReadToEnd()
            $reader.Close(); $stream.Close()
            foreach ($pattern in $patterns) {
                if ($content -match [regex]::Escape($pattern)) {
                    Write-Host "=== $name ==="
                    Write-Host "pattern: $pattern"
                    break
                }
            }
        }
    }
} finally {
    $zip.Dispose()
}
