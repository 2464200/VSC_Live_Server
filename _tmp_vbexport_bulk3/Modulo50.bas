Attribute VB_Name = "Modulo50"
Attribute VB_Name = "Modulo50"

Option Explicit

'Aggiornamento automatico colore: avviene quando cambi NextCoreo!A1.



' === SOLO COLORE: aggiorna il colore del pulsante associato alla macro ===
' Verde se esiste una riga nel CSV in cui i primi 3 caratteri della colonna A
' corrispondono al valore di NextCoreo!A1; altrimenti Rosso.
Public Sub VideoClip_ColorOnly()
    On Error GoTo ErrHandler
    
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("VideoClip")
    
    Dim chiave As String
    chiave = Trim$(CStr(ws.Range("A1").Value))
    
    ' Percorsi e impostazioni
    Dim csvPath As String: csvPath = "C:\VSC_Live_Server\VideoClip.csv"
    Dim delimiter As String: delimiter = ","  ' cambia a ";" se il CSV usa punto e virgola
    
    Dim trovata As Boolean
    If chiave <> "" Then
        trovata = CheckCSVForPrefix(csvPath, delimiter, chiave)
    Else
        trovata = False
    End If
    
    ' Colora il pulsante associato a questa macro
    ColorAssociatedButton IIf(trovata, vbGreen, vbRed)
    
    Exit Sub

ErrHandler:
    MsgBox "Errore (ColorOnly): " & Err.Description, vbCritical, "VideoClip"
End Sub

' sezione disabilitata per non far aprire la pagina su Chrome quando viene premuto il tasto PUBBLICA SUL TABELLONE
' === SOLO APERTURA PAGINA: apre Chrome sulla pagina locale HTML ===
'Public Sub VideoClip_OpenPage()
    'On Error GoTo ErrHandler
    
    'Dim htmlPath As String
    'htmlPath = "C:\VSC_Live_Server\prova\prova.html"
    
    'OpenInChrome htmlPath
    'Exit Sub

'ErrHandler:
    'MsgBox "Errore (OpenPage): " & Err.Description, vbCritical, "VideoClip"
'End Sub


' === Verifica nel CSV se esiste una riga dove i primi 3 caratteri della colonna A corrispondono alla chiave ===
Private Function CheckCSVForPrefix(ByVal path As String, ByVal delimiter As String, ByVal chiave As String) As Boolean
    On Error GoTo ErrHandler
    
    Dim fso As Object, ts As Object
    Dim riga As String, primoCampo As String
    
    Set fso = CreateObject("Scripting.FileSystemObject")
    If Not fso.FileExists(path) Then
        MsgBox "File CSV non trovato:" & vbCrLf & path, vbExclamation, "VideoClip"
        Exit Function
    End If
    
    Set ts = fso.OpenTextFile(path, 1, False) ' ForReading
    Do While Not ts.AtEndOfStream
        riga = ts.ReadLine
        
        ' Estrai il primo campo (colonna A). Se servono virgolette e delimitatori complessi,
        ' pu? essere necessario un parser pi? sofisticato.
        primoCampo = GetFirstField(riga, delimiter)
        
        If Len(primoCampo) >= 3 Then
            If StrComp(Left$(primoCampo, 3), chiave, vbTextCompare) = 0 Then
                CheckCSVForPrefix = True
                Exit Do
            End If
        End If
    Loop
    ts.Close
    
    Exit Function
ErrHandler:
    On Error Resume Next
    If Not ts Is Nothing Then ts.Close
End Function


' === Estrae il primo campo da una riga CSV ===
Private Function GetFirstField(ByVal line As String, ByVal delimiter As String) As String
    Dim arr As Variant
    arr = Split(line, delimiter)
    GetFirstField = Trim$(CStr(arr(0)))
    
    ' Rimuovi eventuali doppi apici esterni
    If Len(GetFirstField) >= 2 Then
        If Left$(GetFirstField, 1) = """" And Right$(GetFirstField, 1) = """" Then
            GetFirstField = Mid$(GetFirstField, 2, Len(GetFirstField) - 2)
        End If
    End If
End Function


' === Colora il pulsante che ha la macro assegnata (Form Control / Shape) ===
Private Sub ColorAssociatedButton(ByVal rgbColor As Long)
    On Error GoTo Fallback
    
    Dim callerName As String
    callerName = Application.Caller ' Funziona per pulsanti modulo / forme con OnAction
    
    If Len(callerName) > 0 Then
        With ActiveSheet.Shapes(callerName)
            If .Fill.Visible Then .Fill.ForeColor.RGB = rgbColor
            .line.ForeColor.RGB = rgbColor
        End With
        Exit Sub
    End If
    
Fallback:
    ' Se Application.Caller non ? disponibile, cerca la shape con OnAction = una delle macro
    Dim shp As Shape
    For Each shp In ActiveSheet.Shapes
        If shp.OnAction = "VideoClip" Or shp.OnAction = "VideoClip_ColorOnly" Then
            If shp.Fill.Visible Then shp.Fill.ForeColor.RGB = rgbColor
            shp.line.ForeColor.RGB = rgbColor
            Exit For
        End If
    Next shp
End Sub


' === Apre Chrome sulla pagina indicata. Se Chrome non ? trovato, usa il browser predefinito ===
Private Sub OpenInChrome(ByVal filePath As String)
    On Error GoTo ErrHandler
    
    Dim chromePath As String
    chromePath = GetChromePath()
    
    If chromePath <> "" Then
        Dim cmd As String
        ' Metti tra virgolette percorso e file per gestire spazi
        cmd = """" & chromePath & """ """ & filePath & """"
        shell cmd, vbNormalFocus
    Else
        ' Fallback: apre con il browser predefinito
        ThisWorkbook.FollowHyperlink filePath
    End If
    
    Exit Sub
ErrHandler:
    MsgBox "Impossibile aprire la pagina: " & filePath & vbCrLf & Err.Description, vbExclamation, "VideoClip"
End Sub


' === Individua il percorso di Chrome (x64 / x86). Restituisce stringa vuota se non trovato ===
Private Function GetChromePath() As String
    Dim p1 As String, p2 As String
    p1 = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    p2 = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    
    If Dir$(p1) <> "" Then
        GetChromePath = p1
    ElseIf Dir$(p2) <> "" Then
        GetChromePath = p2
    Else
        GetChromePath = ""
    End If
End Function


