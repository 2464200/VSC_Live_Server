Add-Type -AssemblyName System.IO.Compression.FileSystem
$file = 'C:\Users\Luca\AppData\Local\Temp\tmp_excel_inspect.xlsm'
$zip = [System.IO.Compression.ZipFile]::OpenRead($file)
$names = @('xl/worksheets/sheet1.xml', 'xl/worksheets/_rels/sheet1.xml.rels')
try {
    foreach ($name in $names) {
        $entry = $zip.GetEntry($name)
        if (-not $entry) { Write-Host "Missing: $name"; continue }
        Write-Host "=== $name ==="
        $reader = New-Object System.IO.StreamReader($entry.Open())
        $content = $reader.ReadToEnd()
        $reader.Close()
        $lines = $content -split "`n"
        foreach ($line in $lines) {
            if ($line -match 'activeX1|activeX2|oleObject|object|drawing|rel|shape|button|Start Video|VIDEO|FmlaMacro|Control') {
                Write-Host $line
            }
        }
        Write-Host
    }
} finally {
    $zip.Dispose()
}
