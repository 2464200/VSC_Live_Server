Attribute VB_Name = "Modulo13"
Sub avvia_ricerca_ID()


'
' avvia_ricerca_ID Macro
'

'
    ActiveSheet.Range("A11:N" & LastRowBorder()").AutoFilter Field:=3, Criteria1:=Range("$D$9:$D$9"), _
        Operator:=xlAnd
    Range("$D$9").Select
    End Sub
    

Sub cancella_ricerca_ID()
'
' cancella_ricerca_ID Macro
'

'
    ActiveSheet.AutoFilterMode = False
    ActiveSheet.Range("A11:N" & LastRowBorder()").AutoFilter Field:=3
    Range("$D$9").Select
    Selection.ClearContents
End Sub



