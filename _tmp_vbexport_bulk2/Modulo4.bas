Attribute VB_Name = "Modulo4"

Public Sub Worksheet_Change(ByVal Target As Range)
'condizione se si modifica una riga valida nell'intervallo dati
If Not Intersect(Target, Range("A11:A" & LastRowBorder())) Is Nothing Then
    'inserisci la data in colonna F
    Target.Offset(, 1) = ADESSO()
End If

End Sub
