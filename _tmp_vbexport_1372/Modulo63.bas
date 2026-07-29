Attribute VB_Name = "Modulo63"
' ESPORTA DATI NEL FILE EXPORT_TOT_COREO_ESEGUITE.CVS PER LA PAGINA DELLE STATISTICHE IN VSC

Option Explicit

' === CONFIGURAZIONE ===
Private Const SHEET_NAME As String = "borderò"
Private Const OUT_FOLDER As String = "C:\VSC_Live_Server\Prova\"
Private Const OUT_FILENAME As String = "EXPORT_TOT_COREO_ESEGUITE.csv"
Private Const delim As String = ";"          ' Usa ";" per Excel/IT, "," se preferisci la virgola
Private Const INCLUDE_HEADER As Boolean = True
Private Const SKIP_EMPTY_ROWS As Boolean = True   ' True = salta righe completamente vuote (A:D)

Public Sub EsportaBorderoCSV()
    Dim ws As Worksheet
    Set ws = GetWorksheetByName(SHEET_NAME)
    If ws Is Nothing Then
        MsgBox "Foglio '" & SHEET_NAME & "' non trovato.", vbExclamation
        Exit Sub
    End If

    ' Leggi intestazione (A11:D11) e dati (A12:D612)
    Dim header As Variant, data As Variant
    header = ws.Range("A11:D11").Value2
    data = ws.Range("A12:D612").Value2

    Dim text As String: text = ""

    ' Riga di intestazione
    If INCLUDE_HEADER Then
        text = BuildCSVLine(header, delim)
    End If

    ' Dati: applica padding a 3 cifre alla terza colonna (colonna C del foglio)
    Dim i As Long, j As Long
    For i = 1 To UBound(data, 1)
        If Not (SKIP_EMPTY_ROWS And IsEmptyRow(data, i, 1, 4)) Then
            Dim rowVals(1 To 4) As String
            For j = 1 To 4
                If j = 3 Then
                    rowVals(j) = PadTo3(data(i, j))        ' padding colonna C
                Else
                    rowVals(j) = ToStr(data(i, j))
                End If
            Next j

            If Len(text) > 0 Then text = text & vbCrLf
            text = text & BuildCSVLineFromStrings(rowVals, delim)
        End If
    Next i

    EnsureFolderExists OUT_FOLDER
    WriteUtf8WithBOM OUT_FOLDER & OUT_FILENAME, text

    MsgBox "CSV creato in: " & OUT_FOLDER & OUT_FILENAME, vbInformation
End Sub

' ======= Funzioni di supporto =======

Private Function GetWorksheetByName(name As String) As Worksheet
    On Error Resume Next
    Set GetWorksheetByName = ThisWorkbook.Worksheets(name)
    On Error GoTo 0
End Function

Private Function ToStr(v As Variant) As String
    If IsError(v) Then
        ToStr = ""
    ElseIf IsEmpty(v) Or v = "" Then
        ToStr = ""
    Else
        ToStr = CStr(v)
    End If
End Function

' Padding a 3 cifre:
' - Se il valore è numerico intero (es. 12 o 12,0) ? "012", "012"
' - Mantiene gli zeri iniziali già presenti (es. "7" ? "007"; "045" resta "045")
' - Se è vuoto ? stringa vuota
Private Function PadTo3(val As Variant) As String
    Dim s As String
    s = Trim(ToStr(val))
    If s = "" Then
        PadTo3 = ""
        Exit Function
    End If

    ' Normalizza decimali con virgola e tenta parse numerico
    Dim sn As String
    sn = Replace(s, ",", ".")
    If IsNumeric(sn) Then
        Dim d As Double
        d = CDbl(sn)
        If d = Fix(d) Then
            s = CStr(CLng(d)) ' es. 12.0 -> "12"
        End If
    End If

    If Len(s) < 3 Then s = Right$(String$(3, "0") & s, 3)
    PadTo3 = s
End Function

' Costruisce una riga CSV da una Range(1x4) letta con .Value2
Private Function BuildCSVLine(cells As Variant, delim As String) As String
    Dim parts(1 To 4) As String, j As Long
    For j = 1 To 4
        parts(j) = EscapeCSVField(ToStr(cells(1, j)), delim)
    Next j
    BuildCSVLine = Join(parts, delim)
End Function

' Costruisce una riga CSV da un array di stringhe già pronte (1..4)
Private Function BuildCSVLineFromStrings(arr() As String, delim As String) As String
    Dim parts() As String, j As Long
    ReDim parts(1 To UBound(arr))
    For j = 1 To UBound(arr)
        parts(j) = EscapeCSVField(arr(j), delim)
    Next j
    BuildCSVLineFromStrings = Join(parts, delim)
End Function

' Regole CSV: raddoppia le doppie virgolette e racchiudi tra "" se contiene separatore, apici o a capo
Private Function EscapeCSVField(s As String, delim As String) As String
    If InStr(1, s, """") > 0 Then s = Replace(s, """", """""")
    If InStr(1, s, delim) > 0 Or InStr(1, s, vbCr) > 0 Or InStr(1, s, vbLf) > 0 _
       Or Left$(s, 1) = " " Or Right$(s, 1) = " " Then
        EscapeCSVField = """" & s & """"
    Else
        EscapeCSVField = s
    End If
End Function

' Verifica se la riga i (tra le colonne firstCol..lastCol) è completamente vuota
Private Function IsEmptyRow(data As Variant, i As Long, firstCol As Long, lastCol As Long) As Boolean
    Dim j As Long
    For j = firstCol To lastCol
        If Len(Trim(ToStr(data(i, j)))) > 0 Then
            IsEmptyRow = False
            Exit Function
        End If
    Next j
    IsEmptyRow = True
End Function

' Crea la cartella se non esiste
Private Sub EnsureFolderExists(ByVal folderPath As String)
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    If Not fso.FolderExists(folderPath) Then
        fso.CreateFolder folderPath
    End If
End Sub

' Scrive testo UTF-8 con BOM (compatibile Excel/Windows)
Private Sub WriteUtf8WithBOM(ByVal fullPath As String, ByVal content As String)
    Dim stm As Object
    Set stm = CreateObject("ADODB.Stream")
    stm.Type = 2                 ' adTypeText
    stm.Charset = "utf-8"
    stm.Open
    stm.WriteText content
    stm.SaveToFile fullPath, 2   ' adSaveCreateOverWrite
    stm.Close
    Set stm = Nothing
End Sub



