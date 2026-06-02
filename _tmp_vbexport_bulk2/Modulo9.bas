Attribute VB_Name = "Modulo9"
Sub ordina_brano()
'
' ordina_brano Macro
'

'
    Call cancella_filtro
    ActiveWorkbook.Worksheets("border�").AutoFilter.Sort.SortFields.Clear
    ActiveWorkbook.Worksheets("border�").AutoFilter.Sort.SortFields.Add2 Key:= _
        Range("$E$11:$E" & LastRowBorder()), SortOn:=xlSortOnValues, Order:=xlAscending, DataOption _
        :=xlSortTextAsNumbers
    With ActiveWorkbook.Worksheets("border�").AutoFilter.Sort
        .header = xlYes
        .MatchCase = False
        .Orientation = xlTopToBottom
        .SortMethod = xlPinYin
        .Apply
    End With
    ActiveWorkbook.Worksheets("border�").AutoFilter.Sort.SortFields.Clear
    ActiveWorkbook.Worksheets("border�").AutoFilter.Sort.SortFields.Add2 Key:= _
        Range("$E$11:$E" & LastRowBorder()), SortOn:=xlSortOnCellColor, Order:=xlAscending, _
        DataOption:=xlSortTextAsNumbers
    With ActiveWorkbook.Worksheets("border�").AutoFilter.Sort
        .header = xlYes
        .MatchCase = False
        .Orientation = xlTopToBottom
        .SortMethod = xlPinYin
        .Apply
    End With
End Sub


'Sub ordina_autore()
'
' ordina_autore Macro
'

'
'    Call cancella_filtro
'    ActiveWorkbook.Worksheets("border�").AutoFilter.Sort.SortFields.Clear
'    ActiveWorkbook.Worksheets("border�").AutoFilter.Sort.SortFields.Add2 Key:= _
'       Range("$F$11:$F$" & LastRowBorder()), SortOn:=xlSortOnValues, Order:=xlAscending, DataOption _
'        :=xlSortTextAsNumbers
'    With ActiveWorkbook.Worksheets("border�").AutoFilter.Sort
'        .Header = xlYes
'        .MatchCase = False
'        .Orientation = xlTopToBottom
'        .SortMethod = xlPinYin
'        .Apply
'    End With
'    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=6, Criteria1:="<>"
'End Sub


Sub ordina_autore()
'
' ordina_autore Macro
'

'
    Call cancella_filtro
    ActiveWorkbook.Worksheets("border�").AutoFilter.Sort.SortFields.Clear
    ActiveWorkbook.Worksheets("border�").AutoFilter.Sort.SortFields.Add2 Key:= _
        Range("$F$11:$F$" & LastRowBorder()), SortOn:=xlSortOnValues, Order:=xlAscending, DataOption _
        :=xlSortTextAsNumbers
    With ActiveWorkbook.Worksheets("border�").AutoFilter.Sort
        .header = xlYes
        .MatchCase = False
        .Orientation = xlTopToBottom
        .SortMethod = xlPinYin
        .Apply
    End With
    ActiveWorkbook.Worksheets("border�").AutoFilter.Sort.SortFields.Clear
    ActiveWorkbook.Worksheets("border�").AutoFilter.Sort.SortFields.Add2 Key:= _
        Range("$F$11:$F$" & LastRowBorder()), SortOn:=xlSortOnCellColor, Order:=xlAscending, _
        DataOption:=xlSortTextAsNumbers
    With ActiveWorkbook.Worksheets("border�").AutoFilter.Sort
        .header = xlYes
        .MatchCase = False
        .Orientation = xlTopToBottom
        .SortMethod = xlPinYin
        .Apply
    End With
End Sub



