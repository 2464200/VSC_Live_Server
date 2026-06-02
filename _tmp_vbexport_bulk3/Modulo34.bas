Attribute VB_Name = "Modulo34"
Attribute VB_Name = "Modulo34"
Sub CopiaERifila(criterio As String)
    Dim wsElencoBrani As Worksheet
    Dim wsLista As Worksheet
    Dim rng1 As Range
    Dim rng2 As Range
    Dim cell As Range
    Dim dict As Object
    Dim OutputRow As Long
    Dim lastRowStatic As Long
    Dim lastRowLista As Long
    
    ' Cerca il foglio "Elenco Brani (statico)"
    For Each ws In ThisWorkbook.Worksheets
        If ws.name = "Elenco Brani (statico)" Then
            Set wsElencoBrani = ws
            Exit For
        End If
    Next ws
    
    If wsElencoBrani Is Nothing Then
        MsgBox "Il foglio 'Elenco Brani (statico)' non esiste.", vbExclamation
        Exit Sub
    End If
    
    ' Imposta il foglio "Lista per serata"
    On Error Resume Next
    Set wsLista = ThisWorkbook.Worksheets("Lista per serata")
    On Error GoTo 0
    If wsLista Is Nothing Then
        MsgBox "Il foglio 'Lista per serata' non esiste.", vbExclamation
        Exit Sub
    End If

    ' Copia il primo intervallo
    lastRowStatic = Application.WorksheetFunction.Max(
        wsElencoBrani.Cells(wsElencoBrani.Rows.Count, "B").End(xlUp).Row, _
        wsElencoBrani.Cells(wsElencoBrani.Rows.Count, "H").End(xlUp).Row)
    If lastRowStatic < 2 Then
        MsgBox "Nessun dato valido in 'Elenco Brani (statico)'", vbExclamation
        Exit Sub
    End If
    Set rng1 = wsElencoBrani.Range("$B$2:$D$" & lastRowStatic)
    rng1.Copy Destination:=wsLista.Range("$B$8")

    ' Copia il secondo intervallo
    Set rng2 = wsElencoBrani.Range("$H$2:$J$" & lastRowStatic)
    rng2.Copy Destination:=wsLista.Range("$E$8")

    ' Inizializza il Dictionary
    Set dict = CreateObject("Scripting.Dictionary")
    
    ' Leggi i dati dall'intervallo "D8:D" & lastRowLista & "" del foglio Lista per serata
    lastRowLista = wsLista.cells(wsLista.Rows.Count, "D").End(xlUp).Row
    If lastRowLista < 8 Then
        lastRowLista = 8
    End If
    Set rng1 = wsLista.Range("$D$8:$D$" & lastRowLista)
    
    ' Aggiungi i valori univoci al Dictionary
    For Each cell In rng1
        If Not IsEmpty(cell.Value) Then ' Ignora celle vuote
            If Not dict.Exists(cell.Value) Then
                dict.Add cell.Value, cell.Value
            End If
        End If
    Next cell
    
    ' Scrivi i valori univoci nella colonna D del foglio "Lista per serata"
    OutputRow = 8 ' Partenza dalla riga 8
    For Each Key In dict.keys
        wsLista.cells(OutputRow, "D").Value = Key
        OutputRow = OutputRow + 1
    Next Key
    
    ' Rimuove i dati duplicati residui nella colonna D
    Dim finalRowLista As Long
    finalRowLista = wsLista.cells(wsLista.Rows.Count, "D").End(xlUp).Row
    If OutputRow <= finalRowLista Then
        wsLista.Range("D" & OutputRow & ":D" & finalRowLista).ClearContents
    End If
    
    ' Applica il filtro
    With wsLista
        Dim filterLastRow As Long
        filterLastRow = .cells(.Rows.Count, "A").End(xlUp).Row
        If filterLastRow < 7 Then filterLastRow = 7
        .Range("$A$7:$G" & filterLastRow).AutoFilter Field:=5, Criteria1:=criterio
    End With
    
    ' MsgBox "Operazione completata con successo!", vbInformation
End Sub

Sub Lista_BASE()
    CopiaERifila "BASE"
End Sub
    
Sub Lista_INTERMEDIO()
    CopiaERifila "INTERMEDIO"
End Sub
Sub Lista_AVANZATO_1()
    CopiaERifila "AVANZATO 1"
End Sub
Sub Lista_AVANZATO_2()
    CopiaERifila "AVANZATO 2"
End Sub
Sub Lista_SUPERAVANZATO_2()
    CopiaERifila "SUPER AVANZATO 2"
End Sub
Sub Lista_ALTRE_COREO()
    CopiaERifila "ALTRE COREO"
End Sub
Sub Lista_CANC()
Attribute Lista_CANC.VB_Description = "Cancella il filtro applicato sulla lista"
Attribute Lista_CANC.VB_ProcData.VB_Invoke_Func = " \n14"
'
' Lista_CANC Macro
' Cancella il filtro applicato sulla lista
'

'
    ActiveSheet.AutoFilterMode = False
    Dim lastRowListaC As Long
    lastRowListaC = ActiveSheet.cells(ActiveSheet.Rows.Count, "A").End(xlUp).Row
    If lastRowListaC < 7 Then lastRowListaC = 7
    ActiveSheet.Range("$A$7:$G" & lastRowListaC).AutoFilter Field:=5
End Sub
Sub StampaFoglioAttivoA4()
    Dim ws As Worksheet

    ' Imposta il foglio attivo come oggetto ws
    Set ws = ActiveSheet

    ' Configura le impostazioni della pagina
    With ws.PageSetup
        .PaperSize = xlPaperA4       ' Imposta il formato carta A4
        .Orientation = xlPortrait    ' Imposta l'orientamento verticale
        .Zoom = False                ' Disattiva lo zoom
        .FitToPagesWide = 1          ' Adatta il contenuto alla larghezza di una pagina
        .FitToPagesTall = 4          ' Adatta il contenuto all'altezza di una pagina
        .TopMargin = Application.InchesToPoints(0.5)    ' Margine superiore
        .BottomMargin = Application.InchesToPoints(0.5) ' Margine inferiore
        .LeftMargin = Application.InchesToPoints(0.5)   ' Margine sinistro
        .RightMargin = Application.InchesToPoints(0.5)  ' Margine destro
    End With

    ' Mostra la finestra di dialogo di stampa
    Application.Dialogs(xlDialogPrint).Show
End Sub




