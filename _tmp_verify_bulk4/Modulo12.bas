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
    Range("$A$12:$B$612").Select
    Range("$A$612").Activate
    Selection.ClearContents
    Range("$B$612").Select
            
    Range("B12:B" & LastRowBorder()").Select
    Range("$B$612").Activate
    Selection.ClearContents
    
    Selection.End(xlUp).Select
    ActiveWindow.SmallScroll Down:=-6
    Selection.ClearContents
    Range("$A$11:$N$11").Select
    Range(Selection, Selection.End(xlDown)).Select
    Range(Selection, Selection.End(xlUp)).Select
    Range("$A12:$N$612").Select
    ActiveWorkbook.Worksheets("borderò").Sort.SortFields.Clear
    ActiveWorkbook.Worksheets("borderò").Sort.SortFields.Add2 Key:=Range( _
        "$C$12:$C$612"), SortOn:=xlSortOnValues, Order:=xlAscending, DataOption:= _
        xlSortNormal
    With ActiveWorkbook.Worksheets("borderò").Sort
        .SetRange Range("A12:N" & LastRowBorder()")
        .header = xlGuess
        .MatchCase = False
        .Orientation = xlTopToBottom
        .SortMethod = xlPinYin
        .Apply
    End With
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

