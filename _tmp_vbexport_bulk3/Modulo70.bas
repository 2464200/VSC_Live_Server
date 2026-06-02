Attribute VB_Name = "Modulo70"
Attribute VB_Name = "Modulo70"
Option Explicit

'===============================================================================
' Macro: GeneraFileSIAE
' Scopo:
'   Genera un file CSV UTF-8 conforme al template SIAE,
'   ordinando i record in ordine alfabetico crescente per TITOLO.
'
'   Cartella di destinazione: C:\VSC_SIAE\
'   Nome file: GG-MM-AAAA-hhMM_SIAE_XLS.csv
'
'   Struttura CSV (separatore: ,):
'   Titolo,Autore,Compositore,Performer,Durata
'
'   Origine dati:
'   - Foglio: "Border?"
'   - Righe valide solo se in colonna A ? presente "X" o "x"
'   - Colonna E ? Titolo
'   - Colonna F ? Autore
'===============================================================================
Public Sub GeneraFileSIAE()

    On Error GoTo GestioneErrore
    
    '-----------------------------
    ' Dichiarazione variabili
    '-----------------------------
    Dim wsSorgente As Worksheet
    Dim ultimaRiga As Long
    Dim i As Long, n As Long
    
    Dim percorsoCartella As String
    Dim nomeFile As String
    Dim percorsoCompleto As String
    
    Dim dati() As Variant      ' Array per memorizzare Titolo e Autore
    Dim contenutoCSV As String
    
    Dim streamUTF8 As Object   ' ADODB.Stream
    
    '-----------------------------
    ' Impostazioni iniziali
    '-----------------------------
    Set wsSorgente = ThisWorkbook.Worksheets("Border?")
    percorsoCartella = "C:\VSC_SIAE\"
    
    nomeFile = Format(Now, "dd-mm-yyyy-hhmm") & "_SIAE_XLS.csv"
    percorsoCompleto = percorsoCartella & nomeFile
    
    '-----------------------------
    ' Individuazione ultima riga
    '-----------------------------
    ultimaRiga = wsSorgente.cells(wsSorgente.Rows.Count, "A").End(xlUp).Row
    
    '-----------------------------
    ' Prima passata: conteggio righe valide
    '-----------------------------
    n = 0
    For i = 2 To ultimaRiga
        If UCase(Trim(wsSorgente.cells(i, "A").Value)) = "X" Then
            n = n + 1
        End If
    Next i
    
    ' Se non ci sono dati validi, interrompe
    If n = 0 Then
        MsgBox "Nessun record valido da esportare.", vbExclamation, "Avviso"
        Exit Sub
    End If
    
    '-----------------------------
    ' Dimensionamento array
    ' Colonna 1 = Titolo
    ' Colonna 2 = Autore
    '-----------------------------
    ReDim dati(1 To n, 1 To 2)
    
    '-----------------------------
    ' Seconda passata: caricamento dati
    '-----------------------------
    n = 0
    For i = 2 To ultimaRiga
        
        If UCase(Trim(wsSorgente.cells(i, "A").Value)) = "X" Then
            
            n = n + 1
            dati(n, 1) = Trim(Replace(wsSorgente.cells(i, "E").Value, """", ""))
            dati(n, 2) = Trim(Replace(wsSorgente.cells(i, "F").Value, """", ""))
            
        End If
        
    Next i
    
    '-----------------------------
    ' Ordinamento alfabetico crescente per Titolo
    '-----------------------------
    Call OrdinaArrayPerTitolo(dati)
    
    '-----------------------------
    ' Intestazione CSV
    '-----------------------------
    contenutoCSV = "Titolo,Autore,Compositore,Performer,Durata" & vbCrLf
    
    '-----------------------------
    ' Composizione contenuto CSV
    '-----------------------------
    For i = 1 To UBound(dati, 1)
        contenutoCSV = contenutoCSV & _
                       dati(i, 1) & "," & _
                       dati(i, 2) & ",,," & vbCrLf
    Next i
    
    '-----------------------------
    ' Scrittura file CSV UTF-8
    '-----------------------------
    Set streamUTF8 = CreateObject("ADODB.Stream")
    
    With streamUTF8
        .Type = 2            ' adTypeText
        .Charset = "utf-8"
        .Open
        .WriteText contenutoCSV
        .SaveToFile percorsoCompleto, 2
        .Close
    End With
    
    Set streamUTF8 = Nothing
    
    MsgBox "File SIAE generato e ordinato correttamente:" & vbCrLf & percorsoCompleto, _
           vbInformation, "Operazione completata"
    
    Exit Sub

'-----------------------------
' Gestione errori
' In caso di errore viene mostrato un messaggio
' senza bloccare Excel
'-----------------------------
GestioneErrore:
    MsgBox "Errore durante la generazione del file SIAE:" & vbCrLf & _
           Err.Number & " - " & Err.Description, _
           vbCritical, "Errore"

End Sub

'===============================================================================
' Procedura: OrdinaArrayPerTitolo
' Scopo:
'   Ordina un array bidimensionale (Titolo, Autore)
'   in ordine alfabetico crescente sul campo Titolo
'===============================================================================
Private Sub OrdinaArrayPerTitolo(ByRef arr As Variant)

    Dim i As Long, j As Long
    Dim tmpTitolo As String, tmpAutore As String
    
    For i = LBound(arr, 1) To UBound(arr, 1) - 1
        For j = i + 1 To UBound(arr, 1)
            
            If StrComp(arr(i, 1), arr(j, 1), vbTextCompare) > 0 Then
                
                tmpTitolo = arr(i, 1)
                tmpAutore = arr(i, 2)
                
                arr(i, 1) = arr(j, 1)
                arr(i, 2) = arr(j, 2)
                
                arr(j, 1) = tmpTitolo
                arr(j, 2) = tmpAutore
                
            End If
            
        Next j
    Next i

End Sub



