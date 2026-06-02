Add-Type -AssemblyName System.IO.Compression.FileSystem
$file = 'C:\Users\Luca\AppData\Local\Temp\tmp_excel_inspect.xlsm'
$zip = [System.IO.Compression.ZipFile]::OpenRead($file)
$patterns = @('Start Video','START VIDEO','start video','Video','VIDEO','CommandButton','FmlaMacro','ObjectType','oleObject','ActiveX','control','Caption','_Click')
$targets = @('xl/activeX/activeX1.xml', 'xl/activeX/_rels/activeX1.xml.rels', 'xl/worksheets/sheet1.xml', 'xl/drawings/drawing1.xml', 'xl/drawings/drawing2.xml', 'xl/drawings/drawing3.xml', 'xl/drawings/drawing4.xml', 'xl/drawings/drawing5.xml')
try {
    foreach ($target in $targets) {
        $entry = $zip.GetEntry($target)
        if (-not $entry) { Write-Host "Missing: $target"; continue }
        Write-Host "=== $target ==="
        $s = $entry.Open()
        $reader = New-Object System.IO.StreamReader($s)
        $content = $reader.ReadToEnd()
        $reader.Close(); $s.Close()
        foreach ($pattern in $patterns) {
            $matches = Select-String -InputObject $content -Pattern $pattern
            foreach ($m in $matches) {
                Write-Host "[$pattern] $($m.Line)"
            }
        }
        Write-Host
    }
} finally {
    $zip.Dispose()
}
