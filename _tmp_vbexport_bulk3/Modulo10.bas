Attribute VB_Name = "Modulo10"
Attribute VB_Name = "Modulo10"
Sub filtra_livello()
'
' filtra_livello Macro
'

'
    Call cancella_filtro
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=9
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=10
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=11
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=6
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=7
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=8, Criteria1:="<>"
End Sub


