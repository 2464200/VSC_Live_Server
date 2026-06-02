$src = 'C:\VSC_Live_Server\_tmp_BorderoCopy_bulkfixed.xlsm'
$dst = 'C:\VSC_Live_Server\_tmp_BorderoCopy_bulkfixed3.xlsm'
if (Test-Path $dst) { Remove-Item -Path $dst -Force }
Copy-Item -Path $src -Destination $dst -Force
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($dst, 0, $false)
foreach ($bas in Get-ChildItem -Path 'C:\VSC_Live_Server\_tmp_vbexport_bulk2' -Filter '*.bas' -File) {
    $name = [IO.Path]::GetFileNameWithoutExtension($bas.Name)
    try {
        $comp = $wb.VBProject.VBComponents.Item($name)
        $code = Get-Content -Raw -Encoding UTF8 $bas.FullName
        $code = $code -replace '\r?\n', "`r`n"
        if ($comp.CodeModule.CountOfLines -gt 0) {
            $comp.CodeModule.DeleteLines(1, $comp.CodeModule.CountOfLines)
        }
        $comp.CodeModule.AddFromString($code)
        Write-Output "Updated component: ${name}"
    } catch {
        Write-Output "Could not update component ${name}: $($_.Exception.Message)"
    }
}
$wb.Save()
$wb.Close($false)
$excel.Quit()
Write-Output 'Workbook copy created and modules updated.'
