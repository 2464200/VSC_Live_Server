Attribute VB_Name = "Modulo15"
Sub studiate()
'
' studiate Macro
'

'
    ActiveSheet.AutoFilterMode = False
    ActiveSheet.Range("A11:N" & LastRowBorder()").AutoFilter Field:=6
    ActiveSheet.Range("A11:N" & LastRowBorder()").AutoFilter Field:=7
    ActiveSheet.Range("A11:N" & LastRowBorder()").AutoFilter Field:=8
    ActiveSheet.Range("A11:N" & LastRowBorder()").AutoFilter Field:=9
    ActiveSheet.Range("A11:N" & LastRowBorder()").AutoFilter Field:=10
    ActiveSheet.Range("A11:N" & LastRowBorder()").AutoFilter Field:=12
        ActiveSheet.Range("A12:N" & LastRowBorder()").AutoFilter Field:=11, Criteria1:="<>", _
    Operator:=xlAnd
End Sub

Sub coreografo()
    ' coreografo Macro
    ' Applica i filtri sui campi specifici e ordina l'intervallo basato sulla colonna L
    
    Dim ws As Worksheet
    Dim rngOrdinamento As Range
    Set ws = ActiveSheet
    
    With ws.Range("A11:N" & LastRowBorder()")
        .AutoFilter Field:=6
        .AutoFilter Field:=8
        .AutoFilter Field:=9
        .AutoFilter Field:=10
        .AutoFilter Field:=7
        .AutoFilter Field:=11
        .AutoFilter Field:=12, Criteria1:="<>", Operator:=xlAnd
    End With
    
    ' Imposta l'intervallo di dati da ordinare
    Set rngOrdinamento = ws.Range("A12:N" & LastRowBorder()")
    
    ' Ordina l'intervallo basato sulla colonna L
    rngOrdinamento.Sort Key1:=ws.Range("$L$12"), Order1:=xlAscending, header:=xlNo
End Sub


