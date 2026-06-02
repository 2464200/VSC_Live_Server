Attribute VB_Name = "Modulo4"

Public Sub Worksheet_Change(ByVal Target As Range)
'condizione se si modifica l'intervallo B12:B612
If Not Intersect(Target, [$A$11:$A$612]) Is Nothing Then
    'inserisci la data in colonna F
    Target.Offset(, 1) = ADESSO()
End If

End Sub
