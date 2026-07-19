Attribute VB_Name = "Modulo47"


Option Explicit

Public Sub WritePhraseToCsv(ByVal phrase As String)
    On Error GoTo ErrHandler
    
    Dim folderPath As String
    Dim csvPath As String
    folderPath = "C:\VSC_Live_Server"
    csvPath = folderPath & "\servizio.csv"
    
    ' Crea la cartella se non esiste
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    If Not fso.FolderExists(folderPath) Then
        fso.CreateFolder folderPath
    End If
    
    ' Scrittura in UTF-8 (con BOM) sovrascrivendo il file
    WriteTextUtf8 csvPath, phrase
    
    Exit Sub

ErrHandler:
    Debug.Print "Errore in WritePhraseToCsv: " & Err.Number & " - " & Err.Description
End Sub

Private Sub WriteTextUtf8(ByVal filePath As String, ByVal content As String)
    ' Scrive il testo sovrascrivendo il file in UTF-8 (con BOM).
    ' Se preferisci UTF-8 senza BOM o accodare, dimmelo.
    Dim stm As Object
    Set stm = CreateObject("ADODB.Stream")
    
    With stm
        .Type = 2                ' adText
        .Charset = "utf-8"
        .Open
        .WriteText content, 0    ' 0=adWriteChar; 1=adWriteLine se vuoi aggiungere CRLF automatico
        .SaveToFile filePath, 2  ' 2=adSaveCreateOverWrite (sovrascrive)
        .Close
    End With
End Sub

