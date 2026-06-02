Attribute VB_Name = "Modulo17"
Option Explicit
Public Sub Request()
    Dim ws As Worksheet
    Dim dataRange As Range
    Dim lastRow As Long

    Set ws = ThisWorkbook.Worksheets("borderÃ²")
    lastRow = ws.cells(ws.Rows.Count, "A").End(xlUp).Row
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

' Mantiene solo la selezione su D7 del foglio borderò
Public Sub Pull()

    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("borderò")

    ws.Activate
    ws.Range("D7").Select

End Sub
