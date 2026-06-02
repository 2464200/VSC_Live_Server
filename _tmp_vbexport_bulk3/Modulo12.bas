Attribute VB_Name = "Modulo12"
Attribute VB_Name = "Modulo12"
Sub pulisci_foglio()
'
' pulisci_foglio Macro
' Pulisce il foglio da tutte le informazioni
'

'
    ActiveWindow.ScrollColumn = 3
    ActiveWindow.ScrollColumn = 2
    ActiveWindow.ScrollColumn = 1
    If LastRowBorder() >= 12 Then
        Range("$A$12:$B$" & LastRowBorder()).ClearContents
        Range("$B$12:$B$" & LastRowBorder()).ClearContents
        Range("$A$12:$N$" & LastRowBorder()).Select
        ActiveWorkbook.Worksheets("border?").Sort.SortFields.Clear
        ActiveWorkbook.Worksheets("border?").Sort.SortFields.Add2 Key:=Range( _
            "$C$12:$C$" & LastRowBorder()), SortOn:=xlSortOnValues, Order:=xlAscending, DataOption:= _
            xlSortNormal
        With ActiveWorkbook.Worksheets("border?").Sort
            .SetRange Range("A12:N" & LastRowBorder())
            .header = xlGuess
            .MatchCase = False
            .Orientation = xlTopToBottom
            .SortMethod = xlPinYin
            .Apply
        End With
    End If
'
' Pilisce contenuto caselle identificative dell'evento
'
'
    Range("D3").Select
    Selection.ClearContents
    Range("D4").Select
    Selection.ClearContents
    Range("D5").Select
    Selection.ClearContents

End Sub



