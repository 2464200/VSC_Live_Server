Attribute VB_Name = "Modulo18"
Attribute VB_Name = "Modulo18"
Sub CreaClassifica()
    Dim wsOrigine As Worksheet
    Dim wsDestinazione As Worksheet
    Dim ultimaRiga As Long
    Dim i As Long
    Dim rigaDestinazione As Long
    Dim rigaCoreografieVuote As Long
    Dim dictCoreografie As Object
    Dim coreografiaPiuRichiesta As String
    ' Dim maxRichieste As Long
Dim maxRichieste As Integer
Dim coreografia As Variant

    ' Imposta i riferimenti ai fogli
    Set wsOrigine = ThisWorkbook.Worksheets("Accoda 8+12")
    On Error Resume Next
    Set wsDestinazione = ThisWorkbook.Worksheets("Publisher-show")
    If wsDestinazione Is Nothing Then
        Set wsDestinazione = ThisWorkbook.Worksheets.Add
        wsDestinazione.name = "Publisher-show"
    End If
    On Error GoTo 0

    ' Cancella i dati esistenti nel foglio di destinazione
    wsDestinazione.cells.Clear

    ' Aggiungi intestazioni
    wsDestinazione.cells(1, 1).Value = "Nome"
    wsDestinazione.cells(1, 2).Value = "Coreografia"
    wsDestinazione.cells(1, 4).Value = "la coreografia pi? richiesta di oggi"

    ' Formatta la riga delle intestazioni
    With wsDestinazione.Rows(1)
        .Font.Bold = True                          ' Grassetto
        .HorizontalAlignment = xlCenter            ' Allineamento orizzontale al centro
        .VerticalAlignment = xlCenter              ' Allineamento verticale al centro
        .Interior.Color = RGB(200, 200, 200)       ' Colore di sfondo (grigio chiaro)
        .Font.Color = RGB(0, 0, 0)                 ' Colore del testo (nero)
        .Font.Size = 12                            ' Dimensione del carattere
    End With

        ' Trova l'ultima riga del foglio di origine
    ultimaRiga = wsOrigine.cells(wsOrigine.Rows.Count, "C").End(xlUp).Row

    ' Imposta la riga iniziale per l'inserimento dei dati nel foglio di destinazione
    rigaDestinazione = 2
    rigaCoreografieVuote = ultimaRiga + 2 ' Inizializza la riga per le coreografie senza nome

    ' Inizializza il dizionario per contare le occorrenze delle coreografie
    Set dictCoreografie = CreateObject("Scripting.Dictionary")

    ' Scorri i dati nel foglio di origine
    For i = 2 To ultimaRiga ' Salta l'intestazione
        Dim nome As String
        Dim colonna As Integer
        ' Dim coreografia As String

        nome = wsOrigine.cells(i, "C").Value

        ' Scorri le colonne delle coreografie (E:G e I:S)
        For colonna = 5 To 7
            coreografia = wsOrigine.cells(i, colonna).Value
            If coreografia <> "" Then
                If nome <> "" Then
                    wsDestinazione.cells(rigaDestinazione, 1).Value = nome
                    wsDestinazione.cells(rigaDestinazione, 2).Value = coreografia
                    rigaDestinazione = rigaDestinazione + 1
                Else
                    wsDestinazione.cells(rigaCoreografieVuote, 1).Value = "(Senza Nome)"
                    wsDestinazione.cells(rigaCoreografieVuote, 2).Value = coreografia
                    rigaCoreografieVuote = rigaCoreografieVuote + 1
                End If
                ' Conta le occorrenze della coreografia
                If dictCoreografie.Exists(coreografia) Then
                    dictCoreografie(coreografia) = dictCoreografie(coreografia) + 1
                Else
                    dictCoreografie.Add coreografia, 1
                End If
            End If
        Next colonna

        For colonna = 9 To 19
            coreografia = wsOrigine.cells(i, colonna).Value
            If coreografia <> "" Then
                If nome <> "" Then
                    wsDestinazione.cells(rigaDestinazione, 1).Value = nome
                    wsDestinazione.cells(rigaDestinazione, 2).Value = coreografia
                    rigaDestinazione = rigaDestinazione + 1
                Else
                    wsDestinazione.cells(rigaCoreografieVuote, 1).Value = "(Senza Nome)"
                    wsDestinazione.cells(rigaCoreografieVuote, 2).Value = coreografia
                    rigaCoreografieVuote = rigaCoreografieVuote + 1
                End If
                ' Conta le occorrenze della coreografia
                If dictCoreografie.Exists(coreografia) Then
                    dictCoreografie(coreografia) = dictCoreografie(coreografia) + 1
                Else
                    dictCoreografie.Add coreografia, 1
                End If
            End If
        Next colonna
    Next i

    Set wsOrigine = ThisWorkbook.Worksheets("Publisher-Show")
    
    ' Formatta i dati della colonna B come testo
    Dim lastRowB As Long
    lastRowB = wsOrigine.cells(wsOrigine.Rows.Count, "B").End(xlUp).Row
    If lastRowB < 2 Then lastRowB = 2
    With wsOrigine.Range("$B$2:$B$" & lastRowB)
        .NumberFormat = "@"
    End With
    
    'MsgBox "I dati della colonna B (da B2 a B" & lastRowB & ") sono stati formattati come testo."

' Trova la coreografia pi? richiesta

coreografiaPiuRichiesta = ""
maxRichieste = 0

For Each coreografia In dictCoreografie.keys
    If dictCoreografie(coreografia) > maxRichieste Then
        maxRichieste = dictCoreografie(coreografia)
        coreografiaPiuRichiesta = coreografia
    End If
Next coreografia

Sheets("Publisher-Show").Range("$D$2").Value = coreografiaPiuRichiesta
    
    ' Inserisci la coreografia pi? richiesta nella cella D2
    wsDestinazione.cells(2, 4).Value = coreografiaPiuRichiesta

    ' Formatta il testo nella cella D2 al centro
With wsDestinazione.cells(2, 4)
    .HorizontalAlignment = xlCenter
    .VerticalAlignment = xlCenter
End With

    ' Aggiungi una riga di completamento
    MsgBox "Classifica creata con successo nel foglio 'Publisher-show'!"
    
    ' Regola larghezza delle colonne automaticamente
    wsDestinazione.Columns("A:D").AutoFit

End Sub


