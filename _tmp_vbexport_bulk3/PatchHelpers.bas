Attribute VB_Name = "PatchHelpers"
Attribute VB_Name = "PatchHelpers"
Public Function LastRowBorder() As Long
    With ThisWorkbook.Worksheets("borderò")
        LastRowBorder = .cells(.Rows.Count, "A").End(xlUp).Row
    End With
End Function

