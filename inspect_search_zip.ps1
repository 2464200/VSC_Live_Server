Add-Type -AssemblyName System.IO.Compression.FileSystem
$file = 'C:\Users\Luca\AppData\Local\Temp\tmp_excel_inspect.xlsm'
$zip = [System.IO.Compression.ZipFile]::OpenRead($file)
$patterns = @('Start Video','START VIDEO','start video','Video','VIDEO','CommandButton','FmlaMacro','ObjectType','oleObject','ActiveX','control','Caption','Click','BackColor','ForeColor','RGB')
try {
    foreach ($entry in $zip.Entries | Sort-Object FullName) {
        if ($entry.FullName -match '\.xml$|\.bin$|\.rels$') {
            $stream = $entry.Open()
            $reader = New-Object System.IO.StreamReader($stream)
            $content = $reader.ReadToEnd()
            $reader.Close(); $stream.Close()
            $found = $false
            foreach ($pattern in $patterns) {
                if ($content -match [regex]::Escape($pattern)) {
                    if (-not $found) {
                        Write-Host "=== $($entry.FullName) ==="
                        $found = $true
                    }
                    Write-Host "pattern: $pattern"
                }
            }
            if ($found) { Write-Host }
        }
    }
} finally {
    $zip.Dispose()
}
