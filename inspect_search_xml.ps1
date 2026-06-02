$root = 'C:\Users\Luca\AppData\Local\Temp\excel_inspect'
$patterns = 'Start Video','START VIDEO','start video','Video','VIDEO','CommandButton','FmlaMacro','ObjectType','oleObject','ActiveX','control','Caption'
Get-ChildItem -Path $root -Recurse -Include *.xml | ForEach-Object {
    $path = $_.FullName
    $matches = Select-String -Path $path -Pattern $patterns
    if ($matches) {
        Write-Host "=== $path ==="
        foreach ($m in $matches) {
            Write-Host $m.Line
        }
        Write-Host
    }
}
