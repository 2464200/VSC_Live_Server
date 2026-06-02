$path = 'C:\VSC_Live_Server\_tmp_BorderoCopy_bulkfixed.xlsm'
$exportDir = 'C:\VSC_Live_Server\_tmp_vbexport_bulk'
if (Test-Path $exportDir) { Remove-Item $exportDir -Recurse -Force }
New-Item -Path $exportDir -ItemType Directory | Out-Null
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($path, 0, $true)
foreach ($comp in $wb.VBProject.VBComponents) {
    $fileName = "$exportDir\$($comp.Name).bas"
    try {
        $comp.Export($fileName)
        Write-Output "Exported $fileName"
    } catch {
        Write-Output "Failed export $($comp.Name): $_"
    }
}
$wb.Close($false)
$excel.Quit()
