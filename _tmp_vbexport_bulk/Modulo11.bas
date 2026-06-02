Attribute VB_Name = "Modulo11"
Sub avvia_ricerca()
'
' avvia_ricerca Macro
'

'
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=4, Criteria1:=Range("$d$7:$d$7"), _
        Operator:=xlAnd
    Range("$d$7").Select
End Sub
Sub cancella_ricerca()
'
' cancella_ricerca Macro
'

'
    ActiveSheet.AutoFilterMode = False
    ActiveSheet.Range("A11:N" & LastRowBorder()).AutoFilter Field:=4
    Range("$D$7").Select
    Selection.ClearContents
End Sub


