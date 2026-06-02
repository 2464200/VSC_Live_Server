# Apply bulk textual replacements to exported VBA modules inside a workbook copy
$src = 'C:\VSC_Live_Server\_tmp_BorderoCopy_fixed.xlsm'
$dst = 'C:\VSC_Live_Server\_tmp_BorderoCopy_bulkfixed.xlsm'
if (Test-Path $dst) { Remove-Item $dst -Force }
Copy-Item -Path $src -Destination $dst -Force

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($dst, 0, $false)

function Add-HelperModule {
    param($wb)
    $name = 'PatchHelpers'
    $exists = $false
    foreach ($comp in $wb.VBProject.VBComponents) { if ($comp.Name -eq $name) { $exists = $true; break } }
    if (-not $exists) {
        $mod = $wb.VBProject.VBComponents.Add(1) # vbext_ct_StdModule = 1
        $mod.Name = $name
        $code = @'
Public Function LastRowBorder() As Long
    With ThisWorkbook.Worksheets("borderò")
        LastRowBorder = .Cells(.Rows.Count, "A").End(xlUp).Row
    End With
End Function
'@
        $mod.CodeModule.AddFromString($code)
        Write-Output "Added helper module $name"
    } else {
        Write-Output "Helper module $name already exists"
    }
}

Add-HelperModule -wb $wb

# Replacement map: key = literal to find, value = replacement (for inside quotes)
$replacements = @{
    '$A$11:$N$612' = 'A11:N" & LastRowBorder()'
    'A11:N612' = 'A11:N" & LastRowBorder()'
    '$A$12:$N$612' = 'A12:N" & LastRowBorder()'
    'A12:N612' = 'A12:N" & LastRowBorder()'
    '$A$11:$A$612' = 'A11:A" & LastRowBorder()'
    '$B$12:$B$612' = 'B12:B" & LastRowBorder()'
    '$A$11:$A613' = 'A11:A" & LastRowBorder()'
    'A10:A210' = 'A10:A210' # keep as is
}

# Iterate code modules and perform replacements
foreach ($comp in $wb.VBProject.VBComponents) {
    $cm = $comp.CodeModule
    $total = $cm.CountOfLines
    if ($total -eq 0) { continue }
    $text = $cm.Lines(1, $total)
    $orig = $text
    foreach ($k in $replacements.Keys) {
        $v = $replacements[$k]
        # Replace both with and without $ signs, case-insensitive
        $pattern = [Regex]::Escape($k)
        $text = [Regex]::Replace($text, $pattern, $v, 'IgnoreCase')
    }
    if ($text -ne $orig) {
        # write back
        $cm.DeleteLines(1, $total)
        $cm.InsertLines(1, $text)
        Write-Output "Patched module: $($comp.Name)"
    }
}

$wb.Save()
$wb.Close($false)
$excel.Quit()
Write-Output "Bulk patch applied and saved to $dst"
