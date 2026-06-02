Attribute VB_Name = "Modulo19"
Sub Aggiorna_query_richieste()
Attribute Aggiorna_query_richieste.VB_Description = "Aggiorna la query delle richieste"
Attribute Aggiorna_query_richieste.VB_ProcData.VB_Invoke_Func = " \n14"
'
' Aggiorna_query_richieste Macro con KUTOOLS
' Aggiorna la query delle richieste con KUTOOLS
'

Dim xRg1 As Range
Dim xRg2 As Range
Dim xTxt As String
Dim xCell1 As Range
Dim xCell2 As Range
Dim i As Long
Dim j As Integer
Dim xLen As Integer
Dim xDiffs As Boolean
On Error Resume Next
If ActiveWindow.RangeSelection.Count > 1 Then
xTxt = ActiveWindow.RangeSelection.AddressLocal
Else
xTxt = ActiveSheet.UsedRange.AddressLocal
End If
lOne:
Set xRg1 = Application.InputBox("Range A:", "Kutools for Excel", xTxt, , , , , 8)
If xRg1 Is Nothing Then Exit Sub
If xRg1.Columns.Count > 1 Or xRg1.Areas.Count > 1 Then
MsgBox " Multiple ranges or columns have been selected ", vbInformation, "Kutools for Excel"
GoTo lOne
End If
lTwo:
Set xRg2 = Application.InputBox("Range B:", "Kutools for Excel", "", , , , , 8)
If xRg2 Is Nothing Then Exit Sub
If xRg2.Columns.Count > 1 Or xRg2.Areas.Count > 1 Then
MsgBox "Multiple ranges or columns have been selected", vbInformation, "Kutools for Excel"
GoTo lTwo
End If
If xRg1.CountLarge <> xRg2.CountLarge Then
MsgBox "Two ranges must have the same numbers of cells ", vbInformation, "Kutools for Excel"
GoTo lTwo
End If
xDiffs = (MsgBox("Click Yes to highlight matched data, click No to highlight unmatched data ", vbYesNo + vbQuestion, "Kutools for Excel") = vbNo)
Application.ScreenUpdating = False
xRg2.Interior.ColorIndex = xlNo
xRg1.Interior.ColorIndex = xlNo
For i = 1 To xRg1.Count
Set xCell1 = xRg1.cells(i)
Set xCell2 = xRg2.cells(i)
If xCell1.Value = xCell2.Value Then
If Not xDiffs Then
xCell1.Interior.Color = vbRed
xCell2.Interior.Color = vbRed
End If
Else
If xDiffs Then
xCell1.Interior.Color = vbRed
xCell2.Interior.Color = vbRed
End If
End If
Next
Application.ScreenUpdating = True
End Sub

'    ActiveWorkbook.RefreshAll
