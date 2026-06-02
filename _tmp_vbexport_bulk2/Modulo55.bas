Attribute VB_Name = "Modulo55"
'===REPORT STATISTICO DELLA SERATA ===

Option Explicit

Sub GeneraReportHTML()

    Dim wb As Workbook
    Dim wsAccoda As Worksheet, wsDisplay As Worksheet
    Dim richieste As Long, eseguite As Long, nonEseguite As Long
    Dim dict As Object
    Dim cella As Range, chiave As Variant
    Dim topCoreografia As String
    Dim maxCount As Long
    Dim percorsoHTML As String
    Dim fileHTML As Integer
    Dim riga As Long
    Dim i As Long

    ' === RIFERIMENTI ===
    Set wb = ThisWorkbook
    Set wsAccoda = wb.Sheets("Accoda 8+12")
    Set wsDisplay = wb.Sheets("Display")
    Set dict = CreateObject("Scripting.Dictionary")

    percorsoHTML = "C:\VSC_Live_Server\Prova\Report.html"

    If Dir("C:\VSC_Live_Server\Prova\", vbDirectory) = "" Then
        MsgBox "La cartella di destinazione non esiste.", vbCritical
        Exit Sub
    End If

    ' === 1. CONTEGGI GENERALI ===
    richieste = Application.WorksheetFunction.CountA(wsAccoda.Range("D4:F600,H4:AH600"))

    For riga = 4 To wsDisplay.cells(wsDisplay.Rows.Count, 1).End(xlUp).Row
        If wsDisplay.cells(riga, 1).Value = "X" Then
            eseguite = eseguite + 1
        ElseIf wsDisplay.cells(riga, 1).Value = "" Then
            nonEseguite = nonEseguite + 1
        End If
    Next riga

    ' === 2. CONTEGGIO COREOGRAFIE ===
    For Each cella In wsAccoda.Range("D4:F600,H4:AH600")
        If Trim(cella.Value) <> "" Then
            If Not dict.Exists(cella.Value) Then
                dict.Add cella.Value, 1
            Else
                dict(cella.Value) = dict(cella.Value) + 1
            End If
        End If
    Next cella

    If dict.Count = 0 Then
        MsgBox "Nessuna coreografia trovata.", vbExclamation
        Exit Sub
    End If

    ' === 3. DICTIONARY ? ARRAY ===
    Dim arrKey() As String, arrVal() As Long
    Dim idx As Long

    ReDim arrKey(1 To dict.Count)
    ReDim arrVal(1 To dict.Count)

    idx = 1
    For Each chiave In dict.keys
        arrKey(idx) = chiave
        arrVal(idx) = dict(chiave)
        idx = idx + 1
    Next chiave

    ' === 4. ORDINAMENTO DECRESCENTE ===
    Dim j As Long
    Dim tmpKey As String, tmpVal As Long

    For i = 1 To UBound(arrVal) - 1
        For j = i + 1 To UBound(arrVal)
            If arrVal(j) > arrVal(i) Then
                tmpVal = arrVal(i)
                arrVal(i) = arrVal(j)
                arrVal(j) = tmpVal

                tmpKey = arrKey(i)
                arrKey(i) = arrKey(j)
                arrKey(j) = tmpKey
            End If
        Next j
    Next i

    ' === 5. TOP ===
    topCoreografia = arrKey(1)
    maxCount = arrVal(1)

    Dim numeroTop As Long
    numeroTop = Application.WorksheetFunction.Min(5, UBound(arrKey))

    Dim topN() As String, topNCount() As Long
    ReDim topN(1 To numeroTop)
    ReDim topNCount(1 To numeroTop)

    For i = 1 To numeroTop
        topN(i) = arrKey(i)
        topNCount(i) = arrVal(i)
    Next i

    ' === 6. HTML ===
    fileHTML = FreeFile
    Open percorsoHTML For Output As #fileHTML

    Print #fileHTML, "<!DOCTYPE html>"
    Print #fileHTML, "<html lang='it'>"
    Print #fileHTML, "<head>"
    Print #fileHTML, "<meta charset='UTF-8'>"
    Print #fileHTML, "<meta name='viewport' content='width=device-width, initial-scale=1.0'>"
    Print #fileHTML, "<title>Report Statistico</title>"
    Print #fileHTML, "<script src='https://cdn.jsdelivr.net/npm/chart.js'></script>"

    Print #fileHTML, "<style>"
    Print #fileHTML, "body{font-family:Arial;text-align:center;background:#f4f4f4;margin:0}"
    Print #fileHTML, "nav{background:#333;padding:10px}"
    Print #fileHTML, "nav a{color:#fff;margin:0 15px;text-decoration:none;font-weight:bold}"
    Print #fileHTML, ".container{max-width:1000px;margin:auto}"
    Print #fileHTML, "table{border-collapse:collapse;margin:20px auto;width:100%;background:#fff}"
    Print #fileHTML, "th,td{border:1px solid #ccc;padding:8px}"
    Print #fileHTML, "th{background:#333;color:#fff}"

    Print #fileHTML, ".charts-row{display:flex;gap:20px;align-items:center;margin:20px auto}"
    Print #fileHTML, ".chart-pie{width:260px;height:260px;background:#fff;padding:10px;border-radius:10px}"
    Print #fileHTML, ".chart-bar{flex:1;height:280px;background:#fff;padding:15px;border-radius:10px}"
    Print #fileHTML, "</style>"

    Print #fileHTML, "</head><body>"
    Print #fileHTML, "<nav>"
    Print #fileHTML, "<a href='/index.html'>Home</a>"
    Print #fileHTML, "<a href='/NextCoreo1.html'>NextCoreo1</a>"
    Print #fileHTML, "<a href='/NextCoreo2.html'>NextCoreo2</a>"
    Print #fileHTML, "</nav>"
    Print #fileHTML, "<div class='container'>"

    Print #fileHTML, "<h1>Coreografie - Report Statistico</h1>"
    Print #fileHTML, "<p>Eseguite in totale: <strong>" & eseguite & " </strong>"
    Print #fileHTML, "<p>Richieste con QR: <strong>" & richieste & "</strong> di cui non eseguite: <strong>" & nonEseguite & "</strong></p>"
    Print #fileHTML, "<p>Coreografia piu' richiesta: <strong>" & EscapeHTML(topCoreografia) & "</strong> (" & maxCount & " volte)</p>"

    ' === TABELLA TOP 5 ===
    Print #fileHTML, "<h2>Top " & numeroTop & " Coreografie</h2>"
    Print #fileHTML, "<table>"
    Print #fileHTML, "<tr><th>#</th><th>Coreografia</th><th>Richieste</th></tr>"
    For i = 1 To numeroTop
        Print #fileHTML, "<tr><td>" & i & "</td><td>" & EscapeHTML(topN(i)) & "</td><td>" & topNCount(i) & "</td></tr>"
    Next i
    Print #fileHTML, "</table>"

    ' === GRAFICI AFFIANCATI ===
    Print #fileHTML, "<div class='charts-row'>"
    Print #fileHTML, "<div class='chart-pie'><canvas id='pie'></canvas></div>"
    Print #fileHTML, "<div class='chart-bar'><canvas id='bar'></canvas></div>"
    Print #fileHTML, "</div>"

    Print #fileHTML, "<script>"
    Print #fileHTML, "new Chart(pie,{type:'pie',data:{labels:['Eseguite','Non eseguite'],datasets:[{data:[" & eseguite & "," & nonEseguite & "],backgroundColor:['#28A745','#DC3545']}]} });"

    Print #fileHTML, "new Chart(bar,{type:'bar',data:{labels:["
    For i = 1 To numeroTop
        Print #fileHTML, "'" & EscapeJS(topN(i)) & "'" & IIf(i < numeroTop, ",", "")
    Next i
    Print #fileHTML, "],datasets:[{data:["
    For i = 1 To numeroTop
        Print #fileHTML, topNCount(i) & IIf(i < numeroTop, ",", "")
    Next i
    Print #fileHTML, "],backgroundColor:'#007BFF'}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}}}});"
    Print #fileHTML, "</script>"

    Print #fileHTML, "</div></body></html>"
    Close #fileHTML

    'MsgBox "Report HTML generato correttamente!", vbInformation

End Sub

Function EscapeHTML(ByVal txt As String) As String
    txt = Replace(txt, "&", "&amp;")
    txt = Replace(txt, "<", "&lt;")
    txt = Replace(txt, ">", "&gt;")
    txt = Replace(txt, """", "&quot;")
    txt = Replace(txt, "'", "&#39;")
    EscapeHTML = txt
End Function

Function EscapeJS(ByVal txt As String) As String
    txt = Replace(txt, "\", "\\")
    txt = Replace(txt, "'", "\'")
    txt = Replace(txt, """", "\""")
    EscapeJS = txt
End Function

