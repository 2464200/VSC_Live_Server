Attribute VB_Name = "Modulo31"
Attribute VB_Name = "Modulo31"
Sub pulisci_richieste()
Attribute pulisci_richieste.VB_ProcData.VB_Invoke_Func = " \n14"
'
' pulisci_richieste Macro (Elimina righe MODULO 8 azzerandolo)
'

'
    Sheets("Modulo 8").Select
    Dim lastRowModulo8 As Long
    lastRowModulo8 = cells(Rows.Count, "A").End(xlUp).Row
    If lastRowModulo8 < 2 Then lastRowModulo8 = 2
    Range("$A$2:$AI$" & lastRowModulo8).ClearContents
    Range("$A$2").Select
    Sheets("border?").Select
    ActiveWindow.ScrollRow = 496
    ActiveWindow.ScrollRow = 495
    ActiveWindow.ScrollRow = 493
    ActiveWindow.ScrollRow = 478
    ActiveWindow.ScrollRow = 462
    ActiveWindow.ScrollRow = 430
    ActiveWindow.ScrollRow = 381
    ActiveWindow.ScrollRow = 338
    ActiveWindow.ScrollRow = 330
    ActiveWindow.ScrollRow = 300
    ActiveWindow.ScrollRow = 293
    ActiveWindow.ScrollRow = 271
    ActiveWindow.ScrollRow = 262
    ActiveWindow.ScrollRow = 237
    ActiveWindow.ScrollRow = 215
    ActiveWindow.ScrollRow = 181
    ActiveWindow.ScrollRow = 134
    ActiveWindow.ScrollRow = 123
    ActiveWindow.ScrollRow = 113
    ActiveWindow.ScrollRow = 83
    ActiveWindow.ScrollRow = 76
    ActiveWindow.ScrollRow = 66
    ActiveWindow.ScrollRow = 59
    ActiveWindow.ScrollRow = 45
    ActiveWindow.ScrollRow = 29
    ActiveWindow.ScrollRow = 12
    Range("$D$7").Select
End Sub

