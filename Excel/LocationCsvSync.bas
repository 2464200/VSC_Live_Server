Attribute VB_Name = "LocationCsvSync"
Option Explicit

Private Const LOCATION_SHEET_NAME As String = "Location"
Private Const LOCATION_OUT_PATH As String = "C:\VSC_Live_Server\Bordero\data\location.csv"
Private Const LOCATION_OPTIONS_OUT_PATH As String = "C:\VSC_Live_Server\Bordero\data\location_popup_options.csv"
Private Const DBASE_SHEET_NAME As String = "dBase"
Private Const LOCATION_DELIMITER As String = ","
Private Const LOCATION_HEADER_ROW As Long = 1
Private Const LOCATION_FIRST_COL As Long = 1
Private Const LOCATION_LAST_COL As Long = 20

Public Sub EsportaLocationCSV()
    Dim ws As Worksheet
    Set ws = GetWorksheetByName(LOCATION_SHEET_NAME)
    If ws Is Nothing Then
        MsgBox "Foglio '" & LOCATION_SHEET_NAME & "' non trovato.", vbExclamation, "Export Location CSV"
        Exit Sub
    End If

    Dim lastRow As Long
    lastRow = LastUsedRow(ws, LOCATION_FIRST_COL, LOCATION_LAST_COL)
    If lastRow < LOCATION_HEADER_ROW Then
        MsgBox "Nessun dato disponibile nel foglio '" & LOCATION_SHEET_NAME & "'.", vbExclamation, "Export Location CSV"
        Exit Sub
    End If

    Dim data As Variant
    data = ws.Range(ws.Cells(LOCATION_HEADER_ROW, LOCATION_FIRST_COL), ws.Cells(lastRow, LOCATION_LAST_COL)).Value2

    Dim content As String
    content = BuildLocationCSV(data, LOCATION_DELIMITER)

    EnsureFolderExists Left$(LOCATION_OUT_PATH, InStrRev(LOCATION_OUT_PATH, "\") - 1)
    WriteUtf8WithBOM LOCATION_OUT_PATH, content
End Sub

Public Sub AggiornaLocationCsvAllAvvio()
    On Error GoTo GestioneErrore
    EsportaLocationCSV
    EsportaLocationPopupOptionsCSV
    Exit Sub

GestioneErrore:
    MsgBox "Errore aggiornamento CSV Location: " & Err.Description, vbExclamation, "Location CSV"
End Sub

Public Sub EsportaLocationPopupOptionsCSV()
    Dim ws As Worksheet
    Set ws = GetWorksheetByName(DBASE_SHEET_NAME)
    If ws Is Nothing Then
        MsgBox "Foglio '" & DBASE_SHEET_NAME & "' non trovato.", vbExclamation, "Export Location Popup CSV"
        Exit Sub
    End If

    Dim lines As Collection
    Set lines = New Collection
    lines.Add "group,parent,value"

    AddPopupRows lines, "yesNo", "", ws.Range("A154:A159")
    AddPopupRows lines, "tipoPista", "", ws.Range("A164:A186")
    AddPopupRows lines, "tipoPreseCorrente", "", ws.Range("A191:A199")
    AddPopupRows lines, "province", "", ws.Range("E154:E247")

    Dim lastCol As Long
    lastCol = ws.Cells(153, ws.Columns.Count).End(xlToLeft).Column

    Dim currentCol As Long
    For currentCol = 6 To lastCol
        Dim province As String
        province = Trim$(ToStr(ws.Cells(153, currentCol).Value2))
        If province <> "" Then
            AddPopupRows lines, "paese", province, ws.Range(ws.Cells(154, currentCol), ws.Cells(396, currentCol))
        End If
    Next currentCol

    Dim content As String
    content = JoinCollection(lines, vbCrLf)
    EnsureFolderExists Left$(LOCATION_OPTIONS_OUT_PATH, InStrRev(LOCATION_OPTIONS_OUT_PATH, "\") - 1)
    WriteUtf8WithBOM LOCATION_OPTIONS_OUT_PATH, content
End Sub

Private Function BuildLocationCSV(ByVal data As Variant, ByVal delim As String) As String
    Dim rowsCount As Long
    Dim colsCount As Long
    rowsCount = UBound(data, 1)
    colsCount = UBound(data, 2)

    Dim r As Long
    Dim c As Long
    Dim lines() As String
    ReDim lines(1 To rowsCount)

    For r = 1 To rowsCount
        If r = 1 Or Not IsLocationRowEmpty(data, r, colsCount) Then
            Dim parts() As String
            ReDim parts(1 To colsCount)
            For c = 1 To colsCount
                parts(c) = EscapeCSVField(ToStr(data(r, c)), delim)
            Next c
            lines(r) = Join(parts, delim)
        Else
            lines(r) = vbNullString
        End If
    Next r

    Dim output As String
    For r = 1 To rowsCount
        If Len(lines(r)) > 0 Then
            If Len(output) > 0 Then output = output & vbCrLf
            output = output & lines(r)
        End If
    Next r

    BuildLocationCSV = output
End Function

Private Function IsLocationRowEmpty(ByVal data As Variant, ByVal rowIndex As Long, ByVal colsCount As Long) As Boolean
    Dim c As Long
    For c = 1 To colsCount
        If Len(Trim$(ToStr(data(rowIndex, c)))) > 0 Then
            IsLocationRowEmpty = False
            Exit Function
        End If
    Next c
    IsLocationRowEmpty = True
End Function

Private Function GetWorksheetByName(ByVal sheetName As String) As Worksheet
    On Error Resume Next
    Set GetWorksheetByName = ThisWorkbook.Worksheets(sheetName)
    On Error GoTo 0
End Function

Private Function LastUsedRow(ByVal ws As Worksheet, ByVal firstCol As Long, ByVal lastCol As Long) As Long
    Dim rowIndex As Long
    For rowIndex = ws.Rows.Count To LOCATION_HEADER_ROW Step -1
        If Application.WorksheetFunction.CountA(ws.Range(ws.Cells(rowIndex, firstCol), ws.Cells(rowIndex, lastCol))) > 0 Then
            LastUsedRow = rowIndex
            Exit Function
        End If
    Next rowIndex
    LastUsedRow = LOCATION_HEADER_ROW
End Function

Private Function ToStr(ByVal value As Variant) As String
    If IsError(value) Then
        ToStr = ""
    ElseIf IsEmpty(value) Or IsNull(value) Then
        ToStr = ""
    Else
        ToStr = CStr(value)
    End If
End Function

Private Function EscapeCSVField(ByVal value As String, ByVal delim As String) As String
    If InStr(1, value, """) > 0 Then
        value = Replace$(value, """, """")
    End If

    If InStr(1, value, delim) > 0 Or InStr(1, value, vbCr) > 0 Or InStr(1, value, vbLf) > 0 _
       Or Left$(value, 1) = " " Or Right$(value, 1) = " " Then
        EscapeCSVField = """" & value & """"
    Else
        EscapeCSVField = value
    End If
End Function

Private Sub AddPopupRows(ByRef lines As Collection, ByVal groupName As String, ByVal parentValue As String, ByVal rng As Range)
    Dim cell As Range
    For Each cell In rng.Cells
        Dim itemValue As String
        itemValue = Trim$(ToStr(cell.Value2))
        If itemValue <> "" Then
            lines.Add EscapeCSVField(groupName, LOCATION_DELIMITER) & LOCATION_DELIMITER & _
                      EscapeCSVField(parentValue, LOCATION_DELIMITER) & LOCATION_DELIMITER & _
                      EscapeCSVField(itemValue, LOCATION_DELIMITER)
        End If
    Next cell
End Sub

Private Function JoinCollection(ByVal items As Collection, ByVal separator As String) As String
    Dim index As Long
    For index = 1 To items.Count
        If index > 1 Then JoinCollection = JoinCollection & separator
        JoinCollection = JoinCollection & CStr(items(index))
    Next index
End Function

Private Sub EnsureFolderExists(ByVal folderPath As String)
    Dim fso As Object
    Dim parentPath As String

    If Len(folderPath) = 0 Then Exit Sub
    Set fso = CreateObject("Scripting.FileSystemObject")
    If fso.FolderExists(folderPath) Then Exit Sub

    parentPath = fso.GetParentFolderName(folderPath)
    If Len(parentPath) > 0 And Not fso.FolderExists(parentPath) Then
        EnsureFolderExists parentPath
    End If

    fso.CreateFolder folderPath
End Sub

Private Sub WriteUtf8WithBOM(ByVal fullPath As String, ByVal content As String)
    Dim stm As Object
    Set stm = CreateObject("ADODB.Stream")
    stm.Type = 2
    stm.Charset = "utf-8"
    stm.Open
    stm.WriteText content
    stm.SaveToFile fullPath, 2
    stm.Close
    Set stm = Nothing
End Sub