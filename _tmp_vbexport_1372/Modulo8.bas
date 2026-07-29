Attribute VB_Name = "Modulo8"
Sub cancella_filtro()
Attribute cancella_filtro.VB_ProcData.VB_Invoke_Func = " \n14"
'
' cancella_filtro Macro
'

'
    ActiveSheet.AutoFilterMode = False
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=6
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=7
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=8
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=9
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=10
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=11
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=12
    Range("$C$12").Select
End Sub
Sub info_coreo_1()
Attribute info_coreo_1.VB_ProcData.VB_Invoke_Func = " \n14"
'
' info_coreo_1 Macro
'

'
    Call cancella_filtro
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=6
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=8
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=10
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=11
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=7
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=12
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=9, Criteria1:="<>", _
        Operator:=xlAnd
End Sub
Sub info_coreo_2()
Attribute info_coreo_2.VB_ProcData.VB_Invoke_Func = " \n14"
'
' info_coreo_2 Macro
'

'
    Call cancella_filtro
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=6
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=8
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=9
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=11
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=7
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=12
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=10, Criteria1:="<>", _
        Operator:=xlAnd
End Sub


