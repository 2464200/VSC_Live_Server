Attribute VB_Name = "Modulo3"
Private Sub Worksheet_BeforeDoubleClick(ByVal Target As Range, Cancel As Boolean)
    If Not Intersect(Target, Range("$G$11:$N$612")) Is Nothing Then
        If Target.Value = "X" Then
            Target.ClearContents
            Target.Interior.ColorIndex = xlNone
            Cancel = True
        End If
    End If
End Sub

Private Sub Worksheet_SelectionChange(ByVal Target As Range)
    If Not Intersect(Target, Range("$G$11:$N$612")) Is Nothing And Target.cells.Count = 1 Then
        Intersect(Rows(Target.Row), Range("$G$11:$N$612")).ClearContents
        Intersect(Rows(Target.Row), Range("$G$11:$N$612")).Interior.ColorIndex = xlNone
        Select Case Target.Column
            Case 7
                Target.Interior.Color = 5287936
            Case 8
                Target.Interior.Color = 255
            Case 9
                Target.Interior.Color = 15773696
        End Select
        Target.Value = "X"
        Target.Font.Bold = True
    End If
End Sub


