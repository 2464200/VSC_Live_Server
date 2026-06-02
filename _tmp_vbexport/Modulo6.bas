Attribute VB_Name = "Modulo6"
Sub ordina_id()
    '
    ' Ordina per ID e sposta i brani già eseguiti alla fine dell'elenco.
    '
    Dim ws As Worksheet
    Set ws = ActiveWorkbook.Worksheets("borderò")
    
    ' Verifica che il filtro sia attivo
    If Not ws.AutoFilterMode Then ws.Rows("10:10").AutoFilter

    ' Rimuove eventuali criteri di ordinamento precedenti
    ws.AutoFilter.Sort.SortFields.Clear
    
    ' Ordina per ID (colonna C)
    ws.AutoFilter.Sort.SortFields.Add2 Key:= _
        ws.Range("$C$11:$C$612"), SortOn:=xlSortOnValues, Order:=xlAscending, _
        DataOption:=xlSortTextAsNumbers
    With ws.AutoFilter.Sort
        .header = xlYes
        .MatchCase = False
        .Orientation = xlTopToBottom
        .SortMethod = xlPinYin
        .Apply
    End With
    
    ' Aggiungi un secondo ordinamento (se necessario) per colore
    ws.AutoFilter.Sort.SortFields.Clear
    ws.AutoFilter.Sort.SortFields.Add2 Key:= _
        ws.Range("$C$11:$C$612"), SortOn:=xlSortOnCellColor, Order:=xlAscending
    With ws.AutoFilter.Sort
        .header = xlYes
        .MatchCase = False
        .Orientation = xlTopToBottom
        .SortMethod = xlPinYin
        .Apply
    End With
End Sub

Sub ordina_titolo()
Attribute ordina_titolo.VB_Description = "ordina per TITOLO e metti i brani già eseguiti alla fine dell'elenco"
Attribute ordina_titolo.VB_ProcData.VB_Invoke_Func = " \n14"
'
' ordina_titolo Macro
' ordina per COREOGRAFIA e metti i brani già eseguiti alla fine dell'elenco
'

'
    ActiveWorkbook.Worksheets("borderò").AutoFilter.Sort.SortFields.Clear
    ActiveWorkbook.Worksheets("borderò").AutoFilter.Sort.SortFields.Add2 Key:= _
        Range("$D$11:$D$612"), SortOn:=xlSortOnValues, Order:=xlAscending, DataOption _
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
        Range("$D$11:$D$612"), SortOn:=xlSortOnCellColor, Order:=xlAscending, _
        DataOption:=xlSortTextAsNumbers
    With ActiveWorkbook.Worksheets("borderò").AutoFilter.Sort
        .header = xlYes
        .MatchCase = False
        .Orientation = xlTopToBottom
        .SortMethod = xlPinYin
        .Apply
    End With
End Sub
Sub torna_inizio()
Attribute torna_inizio.VB_Description = "Torna all'inizio dell'elenco"
Attribute torna_inizio.VB_ProcData.VB_Invoke_Func = " \n14"
'
' torna_inizio Macro
' Torna all'inizio dell'elenco
'

'
    Call cancella_filtro
    Call ordina_id
    Range("$D$7").Select
End Sub
