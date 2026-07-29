Attribute VB_Name = "Modulo42"
Sub EsportaDatiInWord_101_Corretto()
    Dim ws As Worksheet
    Dim wordApp As Object
    Dim wordDoc As Object
    Dim valoreD7 As String
    Dim valoreD9 As String
    Dim testoColonnaN As String
    Dim cella As Range
    Dim rigaTrovata As Long
    Dim valoreIntestazioneWord As String ' Variabile per il testo da usare come intestazione in Word
    Dim filePath As String
    Dim objRange As Object
    Dim messaggioFinale As String

    Set ws = ThisWorkbook.Sheets("borderò")
    valoreD7 = ws.Range("D7").Value
    valoreD9 = ws.Range("D9").Value

    rigaTrovata = 0

    ' --- PRIORITY 1: Cerca valoreD7 nella colonna D (D12 in giù) ---
    If Not IsEmpty(valoreD7) Then ' Cerca solo se D7 non è vuoto
        For Each cella In ws.Range("D12:D" & ws.cells(ws.Rows.Count, "D").End(xlUp).Row)
            If cella.Value = valoreD7 Then
                rigaTrovata = cella.Row
                Exit For ' Trovato D7, prende questa riga e non cerca altro
            End If
        Next cella
    End If

    ' --- PRIORITY 2: Se valoreD7 non è stato trovato (o era vuoto), cerca valoreD9 nella colonna C (C12 in giù) ---
    If rigaTrovata = 0 And Not IsEmpty(valoreD9) Then ' Cerca D9 solo se D7 non ha dato risultati E D9 non è vuoto
        For Each cella In ws.Range("C12:C" & ws.cells(ws.Rows.Count, "C").End(xlUp).Row)
            If cella.Value = valoreD9 Then
                rigaTrovata = cella.Row
                Exit For ' Trovato D9, prende questa riga
            End If
        Next cella
    End If

    If rigaTrovata = 0 Then
        MsgBox "Nessun valore corrispondente trovato né per D7 (in colonna D) né per D9 (in colonna C).", vbExclamation
        Exit Sub
    Else
        testoColonnaN = ws.cells(rigaTrovata, "N").Value
        
        ' DECISIONE: Quale valore usare come intestazione/parte in grassetto in Word?
        ' Usa il valore di D7 se D7 non è vuoto.
        ' Altrimenti (se D7 era vuoto o non trovato, e la riga è stata trovata tramite D9),
        ' usa il valore della colonna D della riga trovata.
        If Not IsEmpty(valoreD7) Then
            valoreIntestazioneWord = valoreD7
        Else ' La riga è stata trovata grazie a D9 (o comunque D7 era vuoto)
            valoreIntestazioneWord = ws.cells(rigaTrovata, "D").Value
        End If
    End If

    On Error Resume Next
    Set wordApp = GetObject(Class:="Word.Application")
    If wordApp Is Nothing Then
        Set wordApp = CreateObject("Word.Application")
    End If
    On Error GoTo 0

    wordApp.Visible = True
    Set wordDoc = wordApp.Documents.Add

    Set objRange = wordDoc.content
    ' Usa valoreIntestazioneWord per il testo e per il grassetto
    objRange.text = valoreIntestazioneWord & ":  " & testoColonnaN

    objRange.Start = 0
    objRange.End = Len(valoreIntestazioneWord)
    objRange.Bold = True

    filePath = "D:\DJ Daniel West\LISTA\show_slide_word.docx"

    ' wordDoc.SaveAs2 filePath
    ' wordDoc.Close False
    ' wordApp.Quit

    ' Costruisci il messaggio finale con i risultati trovati
    messaggioFinale = "Esportazione completata! Il testo è stato copiato in un nuovo documento Word." & vbCrLf & vbCrLf & _
                       "Valore trovato (Col. D): " & ws.cells(rigaTrovata, "D").Value & vbCrLf & _
                       "Testo associato (Col. N): " & testoColonnaN

    MsgBox messaggioFinale, vbInformation

    Set objRange = Nothing
    Set wordDoc = Nothing
    Set wordApp = Nothing
    Set ws = Nothing
End Sub

