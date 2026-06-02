Attribute VB_Name = "Modulo29"
Dim NextUpdate As Double

Sub AvviaAggiornamento()
    Dim intervallo As Double
    intervallo = 60 ' ogni 60 secondi
    
    Call EsportaDisplayCSV_DoppioPercorso
    Call TrasferisciDaBorderoConTema_DJ2
    
    NextUpdate = Now + TimeSerial(0, 0, intervallo)
    Application.OnTime NextUpdate, "AvviaAggiornamento"
End Sub

Sub FermaAggiornamento()
    On Error Resume Next
    Application.OnTime NextUpdate, "AvviaAggiornamento", , False
End Sub

Sub EsportaDisplayCSV_DoppioPercorso()
    On Error GoTo ErrHandler
    Application.ScreenUpdating = False
    Application.EnableEvents = False

    Dim percorsi(1 To 2) As String
    Dim percorso As String
    Dim percorsoFolder As String
    Dim ws As Worksheet
    Dim ultimaRiga As Long
    Dim r As Long, C As Long, i As Long
    Dim nCols As Long
    Dim valore As Variant
    Dim linea As String
    Dim buffer As String
    Dim stm As Object

    ' --- CONFIGURAZIONE ---
    percorsi(1) = "C:\VSC_Live_Server\display.csv"
    percorsi(2) = "C:\VSC_Live_Server\public\display.csv"
    nCols = 6                 ' colonne da esportare A..F -> 6
    ' -----------------------

    Set ws = ThisWorkbook.Worksheets("Display")

    ' Calcola ultima riga basandosi sulla colonna B (come nel codice originale)
    If Application.WorksheetFunction.CountA(ws.Columns("B")) = 0 Then
        ultimaRiga = 1
    Else
        ultimaRiga = ws.cells(ws.Rows.Count, "B").End(xlUp).Row + 2
    End If

' Costruisce il contenuto CSV riga per riga, con quoting sicuro
buffer = ""
For r = 1 To ultimaRiga
    linea = ""
    For C = 1 To nCols
        valore = ws.cells(r, C).Value
        If IsError(valore) Then valore = ""
        If IsNull(valore) Then valore = ""
        valore = CStr(valore)

        ' >>>> NOVITÀ: padding a 3 cifre per la colonna B <<<<
        If C = 2 Then
            If Trim(valore) <> "" And IsNumeric(valore) Then
                ' Converte a numero e formatta a 3 cifre
                valore = Format$(CLng(valore), "000")
            ElseIf Trim(valore) <> "" Then
                ' Se è testo non numerico, lo lasciamo com'è (oppure forziamo a 3?)
                ' valore = Left(valore, 3) ' solo se vuoi troncare; altrimenti commenta
            Else
                ' Se vuoto: scegli se lasciare vuoto o "000"
                ' valore = "000"  ' <-- metti questa riga se vuoi che i vuoti diventino "000"
            End If
        End If
        ' <<<< FINE NOVITÀ >>>>

        linea = linea & valore
        If C < nCols Then linea = linea & ","
    Next C
    buffer = buffer & linea & vbCrLf
Next r

    ' Salva il file in ciascun percorso (creando la cartella se necessario)
    For i = 1 To UBound(percorsi)
        percorso = percorsi(i)
        percorsoFolder = Left(percorso, InStrRev(percorso, "\") - 1)

        ' Assicura che la cartella esista (crea solo l'ultimo livello mancante)
        If Dir(percorsoFolder, vbDirectory) = "" Then
            MkDir percorsoFolder
        End If

        ' Scrive il file in UTF-8 usando ADODB.Stream
        Set stm = CreateObject("ADODB.Stream")
        With stm
            .Type = 2 ' adTypeText
            .Charset = "utf-8"
            .Open
            .WriteText buffer
            .SaveToFile percorso, 2 ' adSaveCreateOverWrite
            .Close
        End With
        Set stm = Nothing
    Next i

    'MsgBox "Esportazione completata nei percorsi:" & vbCrLf & _
           percorsi(1) & vbCrLf & percorsi(2), vbInformation

Cleanup:
    Application.ScreenUpdating = True
    Application.EnableEvents = True
    Exit Sub

ErrHandler:
    MsgBox "Errore durante l'esportazione: " & Err.Number & " - " & Err.Description, vbCritical
    Resume Cleanup
End Sub


