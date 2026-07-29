Attribute VB_Name = "Modulo10"
Sub filtra_livello()
Attribute filtra_livello.VB_ProcData.VB_Invoke_Func = " \n14"
'
' filtra_livello Macro
'

'
    Call cancella_filtro
    ActiveSheet.Range("$A$11:$n$612").AutoFilter Field:=9
    ActiveSheet.Range("$A$11:$n$612").AutoFilter Field:=10
    ActiveSheet.Range("$A$11:$n$612").AutoFilter Field:=11
    ActiveSheet.Range("$A$11:$n$612").AutoFilter Field:=6
    ActiveSheet.Range("$A$11:$n$612").AutoFilter Field:=7
    ActiveSheet.Range("$A$11:$n$612").AutoFilter Field:=8, Criteria1:="<>"
End Sub
