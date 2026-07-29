Attribute VB_Name = "Modulo35"
Sub EseguiMacroECambiaFoglio()
    ' Esegui la macro desiderata
    Call EstraiBraniOrdinati ' Sostituisci con il nome della macro da eseguire

    ' Cambia foglio e posizionati sulla cella A3
    Sheets("Risultati").Activate ' Sostituisci con il nome del foglio desiderato
    Range("$I$7").Select
End Sub

