$file = 'C:\Users\Luca\AppData\Local\Temp\excel_inspect\xl\worksheets\sheet1.xml'
$patterns = 'rId4','rId6','activeX','oleObject','control','object','drawing','clientData','button','FmlaMacro'
$content = Get-Content -Path $file
foreach ($line in $content) {
    foreach ($pattern in $patterns) {
        if ($line -match $pattern) {
            Write-Host $line
            break
        }
    }
}
