Attribute VB_Name = "Modulo8"
Sub cancella_filtro()
'
' cancella_filtro Macro
'

'
    ActiveSheet.AutoFilterMode = False
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=6
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=7
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=8
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=9
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=10
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=11
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=12
    Range("$C$12").Select
End Sub
Sub info_coreo_1()
'
' info_coreo_1 Macro
'

'
    Call cancella_filtro
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=6
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=8
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=10
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=11
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=7
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=12
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=9, Criteria1:="<>", _
        Operator:=xlAnd
End Sub
Sub info_coreo_2()
'
' info_coreo_2 Macro
'

'
    Call cancella_filtro
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=6
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=8
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=9
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=11
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=7
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=12
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=10, Criteria1:="<>", _
        Operator:=xlAnd
End Sub




