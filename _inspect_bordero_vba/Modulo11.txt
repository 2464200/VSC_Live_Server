Attribute VB_Name = "Modulo11"
Sub avvia_ricerca()
Attribute avvia_ricerca.VB_ProcData.VB_Invoke_Func = " \n14"
'
' avvia_ricerca Macro
'

'
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=4, Criteria1:=Range("$d$7:$d$7"), _
        Operator:=xlAnd
    Range("$d$7").Select
End Sub
Sub cancella_ricerca()
Attribute cancella_ricerca.VB_ProcData.VB_Invoke_Func = " \n14"
'
' cancella_ricerca Macro
'

'
    ActiveSheet.AutoFilterMode = False
    ActiveSheet.Range("$A$11:$N$612").AutoFilter Field:=4
    Range("$D$7").Select
    Selection.ClearContents
End Sub
