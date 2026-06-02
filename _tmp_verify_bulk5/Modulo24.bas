Attribute VB_Name = "Modulo24"
' NON FUNZIONA
Sub EstraiBraniOrdinatiCasuale5()
    Dim wsLista As Worksheet
    Dim wsRisultati As Worksheet
    Dim ultimaRigaLista As Long
    Dim ultimaRigaRisultati As Long
    Dim criterio As String
    Dim brano As String
    Dim criteri As Variant
    Dim conteggioCriteri As Object
    Dim braniDaEstrarre As Collection
    Dim indiceRandom As Integer
    Dim i As Integer
    Dim riga As Long
    
    ' Crea un dizionario per il conteggio dei criteri
    Set conteggioCriteri = CreateObject("Scripting.Dictionary")
    conteggioCriteri.Add "BASE", 0
    conteggioCriteri.Add "INTERMEDIO", 0
    conteggioCriteri.Add "AVANZATO 1", 0
    conteggioCriteri.Add "AVANZATO 2", 0
    conteggioCriteri.Add "SUPER AVANZATO 2", 0
    
    ' Ordine dei criteri
    criteri = Array("BASE", "INTERMEDIO", "AVANZATO 1", "AVANZATO 2", "SUPER AVANZATO 2")
    
    ' Imposta i fogli
    Set wsLista = ThisWorkbook.Sheets("Elenco Brani (statico)")
    Set wsRisultati = ThisWorkbook.Sheets("Risultati")
    
    ' Trova l'ultima riga del foglio "Elenco Brani (statico)"
    ultimaRigaLista = wsLista.cells(wsLista.Rows.Count, "D").End(xlUp).Row
    
    ' Cancella il contenuto precedente nel foglio "Risultati"
    wsRisultati.cells.ClearContents
    
    ' Inizia dalla riga 1 nel foglio "Risultati"
    ultimaRigaRisultati = 1
    
    ' Collezione per memorizzare le righe da estrarre
    Set braniDaEstrarre = New Collection
    For riga = 2 To ultimaRigaLista
        braniDaEstrarre.Add riga
    Next riga
    
    ' Ripeti finché ci sono brani da estrarre
    Do While braniDaEstrarre.Count > 0
        ' Itera attraverso i criteri nell'ordine specificato
        For i = LBound(criteri) To UBound(criteri)
            If braniDaEstrarre.Count > 0 Then
                ' Estrai un indice casuale
                indiceRandom = Application.WorksheetFunction.RandBetween(1, braniDaEstrarre.Count)
                riga = braniDaEstrarre(indiceRandom)
                
                ' Ottieni il brano e il criterio
                brano = wsLista.cells(riga, "D").Value
                criterio = wsLista.cells(riga, "H").Value
                
                ' Controlla se il criterio corrisponde e rispetta i limiti
                If criterio = criteri(i) Then
                    Select Case criterio
                        Case "BASE"
                            If conteggioCriteri("BASE") < 2 Then
                                AggiungiBranoOrdinato wsRisultati, ultimaRigaRisultati, brano, criterio
                                conteggioCriteri("BASE") = conteggioCriteri("BASE") + 1
                                braniDaEstrarre.Remove indiceRandom
                            End If
                        Case "INTERMEDIO"
                            If conteggioCriteri("INTERMEDIO") < 2 Then
                                AggiungiBranoOrdinato wsRisultati, ultimaRigaRisultati, brano, criterio
                                conteggioCriteri("INTERMEDIO") = conteggioCriteri("INTERMEDIO") + 1
                                braniDaEstrarre.Remove indiceRandom
                            End If
                        Case "AVANZATO 1"
                            If conteggioCriteri("AVANZATO 1") < 1 Then
                                AggiungiBranoOrdinato wsRisultati, ultimaRigaRisultati, brano, criterio
                                conteggioCriteri("AVANZATO 1") = conteggioCriteri("AVANZATO 1") + 1
                                braniDaEstrarre.Remove indiceRandom
                            End If
                        Case "AVANZATO 2"
                            If conteggioCriteri("AVANZATO 2") < 1 Then
                                AggiungiBranoOrdinato wsRisultati, ultimaRigaRisultati, brano, criterio
                                conteggioCriteri("AVANZATO 2") = conteggioCriteri("AVANZATO 2") + 1
                                braniDaEstrarre.Remove indiceRandom
                            End If
                        Case "SUPER AVANZATO 2"
                            If conteggioCriteri("SUPER AVANZATO 2") < 1 Then
                                AggiungiBranoOrdinato wsRisultati, ultimaRigaRisultati, brano, criterio
                                conteggioCriteri("SUPER AVANZATO 2") = conteggioCriteri("SUPER AVANZATO 2") + 1
                                braniDaEstrarre.Remove indiceRandom
                            End If
                    End Select
                End If
            End If
        Next i
    Loop
    
    MsgBox "Estrazione completata e ordinata in modo casuale!", vbInformation
End Sub

Sub AggiungiBranoOrdinato(wsRisultati As Worksheet, ByRef ultimaRigaRisultati As Long, brano As String, criterio As String)
    Dim trovato As Boolean
    Dim cella As Range
    
    ' Imposta trovato come falso di default
    trovato = False
    
    ' Controlla se ci sono righe già popolate prima di iterare
    If ultimaRigaRisultati > 1 Then
        For Each cella In wsRisultati.Range("A1:A" & ultimaRigaRisultati - 1)
            If cella.Value = brano Then
                trovato = True
                Exit For
            End If
        Next cella
    End If
    
    ' Se il brano non è già stato trovato, aggiungilo al foglio "Risultati"
    If Not trovato Then
        wsRisultati.cells(ultimaRigaRisultati, "A").Value = brano
        wsRisultati.cells(ultimaRigaRisultati, "B").Value = criterio
        ultimaRigaRisultati = ultimaRigaRisultati + 1
    End If
End Sub


