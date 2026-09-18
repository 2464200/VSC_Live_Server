$path = 'C:\VSC_Live_Server\_tmp_BorderoCopy.xlsm'
$fixedPath = 'C:\VSC_Live_Server\_tmp_BorderoCopy_fixed.xlsm'
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($path, 0, $false)

Function Replace-Procedure {
    param(
        [string]$componentName,
        [string]$procedureName,
        [string]$newCode
    )
    $cm = $wb.VBProject.VBComponents($componentName).CodeModule
    $start = $cm.ProcStartLine($procedureName, 0)
    $count = $cm.ProcCountLines($procedureName, 0)
    if ($start -gt 0 -and $count -gt 0) {
        $cm.DeleteLines($start, $count)
        $cm.InsertLines($start, $newCode)
        Write-Output "Patched $componentName.$procedureName"
    } else {
        Write-Output "Procedure $procedureName not found in $componentName"
    }
}

$foglio1Code = @'
Private Sub Worksheet_Change(ByVal Target As Range)
    Dim lastRow As Long
    With Me
        lastRow = .Cells(.Rows.Count, "A").End(xlUp).Row
        If lastRow < 11 Then Exit Sub
        If Intersect(Target, .Range("A11:A" & lastRow)) Is Nothing Then Exit Sub
        On Error Resume Next
        Application.EnableEvents = False
        If Target <> "" Then
            .Cells(Target.Row, Target.Column + 1).Value = Now
        End If
        Application.EnableEvents = True
    End With
    'VerificaMatchEAggiornaStato
End Sub
'@

$modulo17Code = @'
Public Sub Request()
    Dim ws As Worksheet
    Dim dataRange As Range
    Dim lastRow As Long

    Set ws = ThisWorkbook.Worksheets("borderò")
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    If lastRow < 11 Then Exit Sub

    Set dataRange = ws.Range("A11:N" & lastRow)

    ' Rimuove eventuali filtri esistenti
    If ws.AutoFilterMode Then
        On Error Resume Next
        ws.ShowAllData
        On Error GoTo 0
    End If

    ' Applica solo il filtro sulla colonna G
    dataRange.AutoFilter
    dataRange.AutoFilter Field:=7, Criteria1:"<>"

    ' Posiziona il cursore su D7
    ws.Activate
    ws.Range("D7").Select
End Sub
'@

Replace-Procedure -componentName 'Foglio1' -procedureName 'Worksheet_Change' -newCode $foglio1Code
Replace-Procedure -componentName 'Modulo17' -procedureName 'Request' -newCode $modulo17Code

$wb.SaveAs($fixedPath, 52)
$wb.Close($false)
$excel.Quit()
Write-Output "Saved fixed workbook to $fixedPath"
