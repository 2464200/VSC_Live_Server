$path = 'C:\VSC_Live_Server\_tmp_BorderoCopy_fixed.xlsm'
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($path, 0, $true)
$components = @('Foglio1','Modulo17')
foreach ($name in $components) {
    $cm = $wb.VBProject.VBComponents($name).CodeModule
    Write-Output "=== $name ==="
    if ($name -eq 'Modulo17') {
        $proc = 'Request'
    } else {
        $proc = 'Worksheet_Change'
    }
    $start = $cm.ProcStartLine($proc, 0)
    $count = $cm.ProcCountLines($proc, 0)
    Write-Output $cm.Lines($start, $count)
}
$wb.Close($false)
$excel.Quit()
