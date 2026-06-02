Attribute VB_Name = "Modulo9"
Sub ordina_brano()
Attribute ordina_brano.VB_ProcData.VB_Invoke_Func = " \n14"
'
' ordina_brano Macro
'

'
    Call cancella_filtro
    ActiveWorkbook.Worksheets("borderò").AutoFilter.Sort.SortFields.Clear
    ActiveWorkbook.Worksheets("borderò").AutoFilter.Sort.SortFields.Add2 Key:= _
        Range("$E$11:$E$612"), SortOn:=xlSortOnValues, Order:=xlAscending, DataOption _
        :=xlSortTextAsNumbers
    With ActiveWorkbook.Worksheets("borderò").AutoFilter.Sort
        .header = xlYes
        .MatchCase = False
        .Orientation = xlTopToBottom
        .SortMethod = xlPinYin
        .Apply
    End With
    ActiveWorkbook.Worksheets("borderò").AutoFilter.Sort.SortFields.Clear
    ActiveWorkbook.Worksheets("borderò").AutoFilter.Sort.SortFields.Add2 Key:= _
        Range("$E$11:$E$612"), SortOn:=xlSortOnCellColor, Order:=xlAscending, _
        DataOption:=xlSortTextAsNumbers
    With ActiveWorkbook.Worksheets("borderò").AutoFilter.Sort
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
'    ActiveWorkbook.Worksheets("borderò").AutoFilter.Sort.SortFields.Clear
'    ActiveWorkbook.Worksheets("borderò").AutoFilter.Sort.SortFields.Add2 Key:= _
'       Range("$F$11:$F$612"), SortOn:=xlSortOnValues, Order:=xlAscending, DataOption _
'        :=xlSortTextAsNumbers
'    With ActiveWorkbook.Worksheets("borderò").AutoFilter.Sort
'        .Header = xlYes
'        .MatchCase = False
'        .Orientation = xlTopToBottom
'        .SortMethod = xlPinYin
'        .Apply
'    End With
'    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=6, Criteria1:="<>"
'End Sub


Sub ordina_autore()
'
' ordina_autore Macro
'

'
    Call cancella_filtro
    ActiveWorkbook.Worksheets("borderò").AutoFilter.Sort.SortFields.Clear
    ActiveWorkbook.Worksheets("borderò").AutoFilter.Sort.SortFields.Add2 Key:= _
        Range("$F$11:$F$612"), SortOn:=xlSortOnValues, Order:=xlAscending, DataOption _
        :=xlSortTextAsNumbers
    With ActiveWorkbook.Worksheets("borderò").AutoFilter.Sort
        .header = xlYes
        .MatchCase = False
        .Orientation = xlTopToBottom
        .SortMethod = xlPinYin
        .Apply
    End With
    ActiveWorkbook.Worksheets("borderò").AutoFilter.Sort.SortFields.Clear
    ActiveWorkbook.Worksheets("borderò").AutoFilter.Sort.SortFields.Add2 Key:= _
        Range("$F$11:$F$612"), SortOn:=xlSortOnCellColor, Order:=xlAscending, _
        DataOption:=xlSortTextAsNumbers
    With ActiveWorkbook.Worksheets("borderò").AutoFilter.Sort
        .header = xlYes
        .MatchCase = False
        .Orientation = xlTopToBottom
        .SortMethod = xlPinYin
        .Apply
    End With
End Sub

