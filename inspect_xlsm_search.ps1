Add-Type -AssemblyName System.IO.Compression.FileSystem
$file = 'C:\Users\Luca\AppData\Local\Temp\tmp_excel_inspect.xlsm'
$patterns = @('Start Video','START VIDEO','start video','StartVideo','Video')
$zip = [System.IO.Compression.ZipFile]::OpenRead($file)
try {
    foreach ($entry in $zip.Entries) {
        if ($entry.FullName -match 'vml|drawing|sheet|activeX|xml') {
            $stream = $entry.Open()
            $reader = New-Object System.IO.StreamReader($stream)
            $text = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
            foreach ($pat in $patterns) {
                if ($text -match [Regex]::Escape($pat)) {
                    Write-Host "=== $($entry.FullName) ==="
                    Write-Host "Pattern: $pat"
                    break
                }
            }
        }
    }
} finally {
    $zip.Dispose()
}
