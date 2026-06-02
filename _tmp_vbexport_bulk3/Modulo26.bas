Attribute VB_Name = "Modulo26"
Attribute VB_Name = "Modulo26"
Sub EstraiBraniOrdinati4()
    Dim wsLista As Worksheet
    Dim wsRisultati As Worksheet
    Dim ultimaRigaLista As Long
    Dim ultimaRigaRisultati As Long
    Dim riga As Long
    Dim criterio As String
    Dim brano As String
    Dim criteri As Variant
    Dim conteggioCriteri As Object
    Dim braniEstratti As Object
    Dim i As Integer
    Dim tuttiEstratti As Boolean
    
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
    
    ' Trova l'ultima riga effettiva (consideriamo massimo 50 righe da riga 2 a 51)
    ultimaRigaLista = Application.WorksheetFunction.Min(wsLista.cells(wsLista.Rows.Count, "D").End(xlUp).Row, 51)
    
    ' Cancella il contenuto precedente nel foglio "Risultati"
    wsRisultati.cells.ClearContents
    
    ' Inizia dalla riga 1 nel foglio "Risultati"
    ultimaRigaRisultati = 1
    
    ' Dizionario per memorizzare i brani estratti
    Set braniEstratti = CreateObject("Scripting.Dictionary")
    
    ' Ciclo finch? tutti i brani non sono stati estratti
    Do
        tuttiEstratti = True
        ' Itera attraverso i criteri nell'ordine stabilito
        For i = LBound(criteri) To UBound(criteri)
            For riga = 2 To ultimaRigaLista ' Limita alle righe da 2 a 51
                brano = wsLista.cells(riga, "D").Value
                criterio = wsLista.cells(riga, "H").Value
                
                ' Controlla se il brano ? gi? stato estratto
                If Not braniEstratti.Exists(brano) Then
                    ' Controlla se il criterio corrisponde e rispetta i limiti
                    If criterio = criteri(i) Then
                        Select Case criterio
                            Case "BASE"
                                If conteggioCriteri("BASE") < 2 Then
                                    AggiungiBranoOrdinato wsRisultati, ultimaRigaRisultati, brano, criterio
                                    conteggioCriteri("BASE") = conteggioCriteri("BASE") + 1
                                    braniEstratti.Add brano, True
                                End If
                            Case "INTERMEDIO"
                                If conteggioCriteri("INTERMEDIO") < 2 Then
                                    AggiungiBranoOrdinato wsRisultati, ultimaRigaRisultati, brano, criterio
                                    conteggioCriteri("INTERMEDIO") = conteggioCriteri("INTERMEDIO") + 1
                                    braniEstratti.Add brano, True
                                End If
                            Case "AVANZATO 1"
                                If conteggioCriteri("AVANZATO 1") < 1 Then
                                    AggiungiBranoOrdinato wsRisultati, ultimaRigaRisultati, brano, criterio
                                    conteggioCriteri("AVANZATO 1") = conteggioCriteri("AVANZATO 1") + 1
                                    braniEstratti.Add brano, True
                                End If
                            Case "AVANZATO 2"
                                If conteggioCriteri("AVANZATO 2") < 1 Then
                                    AggiungiBranoOrdinato wsRisultati, ultimaRigaRisultati, brano, criterio
                                    conteggioCriteri("AVANZATO 2") = conteggioCriteri("AVANZATO 2") + 1
                                    braniEstratti.Add brano, True
                                End If
                            Case "SUPER AVANZATO 2"
                                If conteggioCriteri("SUPER AVANZATO 2") < 1 Then
                                    AggiungiBranoOrdinato wsRisultati, ultimaRigaRisultati, brano, criterio
                                    conteggioCriteri("SUPER AVANZATO 2") = conteggioCriteri("SUPER AVANZATO 2") + 1
                                    braniEstratti.Add brano, True
                                End If
                        End Select
                    End If
                End If
            Next riga
        Next i
        ' Verifica se ci sono ancora brani da estrarre
        For riga = 2 To ultimaRigaLista
            brano = wsLista.cells(riga, "D").Value
            If Not braniEstratti.Exists(brano) Then
                tuttiEstratti = False
                Exit For
            End If
        Next riga
    Loop Until tuttiEstratti
    
    ' Messaggio di completamento
    MsgBox "Estrazione completata e ordinata!", vbInformation
End Sub

Sub AggiungiBranoOrdinato(wsRisultati As Worksheet, ByRef ultimaRigaRisultati As Long, brano As String, criterio As String)
    ' Aggiunge il brano al foglio "Risultati"
    wsRisultati.cells(ultimaRigaRisultati, "A").Value = brano
    wsRisultati.cells(ultimaRigaRisultati, "B").Value = criterio
    ultimaRigaRisultati = ultimaRigaRisultati + 1
End Sub

