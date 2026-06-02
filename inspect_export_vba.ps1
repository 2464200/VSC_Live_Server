$path = 'C:\VSC_Live_Server\_tmp_BorderoCopy.xlsm'
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($path, 0, $true)
$comps = @()
foreach ($comp in $wb.VBProject.VBComponents) {
    $comps += [PSCustomObject]@{
        Name = $comp.Name
        Type = $comp.Type
        CodeName = $comp.CodeName
    }
}
$comps | Format-Table
$wb.Close($false)
$excel.Quit()
