$file = 'C:\Users\Luca\AppData\Local\Temp\excel_inspect\xl\worksheets\sheet1.xml'
$text = Get-Content -Path $file -Raw
$patterns = @('rId4','rId6','activeX1','activeX2','oleObject','control','drawing','r:id','r:embed','FmlaMacro','shape','clientData')
foreach ($pattern in $patterns) {
    $idx = 0
    while ($true) {
        $idx = $text.IndexOf($pattern, $idx, [System.StringComparison]::InvariantCultureIgnoreCase)
        if ($idx -lt 0) { break }
        $start = [Math]::Max(0, $idx - 120)
        $end = [Math]::Min($text.Length, $idx + $pattern.Length + 200)
        $snippet = $text.Substring($start, $end - $start)
        Write-Host "=== $pattern @ $idx ==="
        Write-Host $snippet
        Write-Host
        $idx += $pattern.Length
    }
}
