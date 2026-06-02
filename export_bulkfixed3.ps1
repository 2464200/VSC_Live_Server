$wbPath = 'C:\VSC_Live_Server\_tmp_BorderoCopy_bulkfixed3.xlsm'
$exportDir = 'C:\VSC_Live_Server\_tmp_vbexport_bulk3'
if (Test-Path $exportDir) { Remove-Item -Recurse -Force $exportDir }
New-Item -Path $exportDir -ItemType Directory | Out-Null
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($wbPath, 0, $true)
foreach ($comp in $wb.VBProject.VBComponents) {
    $fileName = Join-Path $exportDir ($comp.Name + '.bas')
    try {
        $comp.Export($fileName)
        Write-Output "Exported $fileName"
    } catch {
        Write-Output "Failed $($comp.Name): $($_.Exception.Message)"
    }
}
$wb.Close($false)
$excel.Quit()
Write-Output 'Export finished.'
