Attribute VB_Name = "Modulo16"
Attribute VB_Name = "Modulo16"
Sub filtra_base()
'
' filtra_base Macro
'

'
    Call cancella_filtro
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=6
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=9
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=10
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=11
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=7
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=12
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=8, Criteria1:="BASE"
End Sub
Sub filtra_avanzato()
'
' filtra_avanzato Macro
'

'
    Call cancella_filtro
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=6
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=9
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=10
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=11
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=7
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=12
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=8, Criteria1:= _
        "=AVANZATO 1", Operator:=xlOr, Criteria2:="=AVANZATO 2"
End Sub
Sub filtra_intermedio()
'
' filtra_intermedio Macro
'

'
    Call cancella_filtro
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=6
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=9
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=10
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=11
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=7
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=12
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=8, Criteria1:= _
        "INTERMEDIO"
End Sub
Sub filtra_superavanzato()
    Dim ws As Worksheet
    Dim rng As Range
    Dim lastRow As Long
    
    Set ws = ActiveSheet
    
    ' Trova l?ultima riga piena nella colonna A
    lastRow = ws.cells(ws.Rows.Count, 1).End(xlUp).Row
    Set rng = ws.Range("A11:N" & lastRow)
    
    ' Rimuovi eventuali filtri precedenti
    On Error Resume Next
    ws.ShowAllData
    On Error GoTo 0
    
    ' Applica filtro colonna 8 con tre criteri
    With rng
.AutoFilter Field:=8, _
            Criteria1:=Array("SUPER AVANZATO 1", _
                             "SUPER AVANZATO 2", _
                             "SUPER AVANZATO 3", _
                             "SUPER AVANZATO 1+2"), _
            Operator:=xlFilterValues

    End With
End Sub

Sub filtra_gold()
'
' filtra_superavanzato Macro
'

'
    Call cancella_filtro
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=6
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=9
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=10
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=11
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=7
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=12
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=8, Criteria1:= _
        "GOLD"
End Sub
Sub filtra_altrecoreo()
'
' filtra_altrecoreo Macro
'

'
    Call cancella_filtro
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=6
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=9
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=10
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=11
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=7
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=12
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=8, Criteria1:= _
        "ALTRE COREO"
End Sub
Sub filtra_request()
'
' filtra_request Macro
'

'
    Call cancella_filtro
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=6
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=8
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=9
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=10
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=11
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=12
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=7, Criteria1:= _
        "<>"
End Sub




