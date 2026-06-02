Attribute VB_Name = "Modulo36"
Attribute VB_Name = "Modulo36"
Sub MacroWrapper()
    Dim shp As Shape
    Dim coloreOriginale As Long
    Dim nuovoColore As Long
    Dim timeout As Double
    Dim nomeMacro As String

    On Error Resume Next
    Set shp = ActiveSheet.Shapes(Application.Caller)
    On Error GoTo 0

    If shp Is Nothing Then
        MsgBox "Errore: La macro deve essere associata a una forma.", vbCritical
        Exit Sub
    End If

    ' Cambia temporaneamente il colore della forma
    coloreOriginale = shp.Fill.ForeColor.RGB
    nuovoColore = RGB(255, 0, 0)
    shp.Fill.ForeColor.RGB = nuovoColore

    ' Attendi 0,3 secondi
    timeout = Timer + 0.3
    Do While Timer < timeout
        DoEvents
    Loop

    ' Ripristina il colore originale
    shp.Fill.ForeColor.RGB = coloreOriginale

    ' Recupera il nome della macro dalla propriet? AlternateText
    nomeMacro = shp.AlternativeText
    If nomeMacro <> "" Then
        On Error Resume Next
        Application.Run "'" & ThisWorkbook.name & "'!NomeMacro"
        If Err.Number <> 0 Then
            MsgBox "Errore durante l'esecuzione della macro '" & nomeMacro & "'.", vbCritical
        End If
        On Error GoTo 0
    Else
        MsgBox "Non ? stato trovato alcun nome della macro nella propriet? AlternateText della forma " & shp.name, vbExclamation
    End If
End Sub

Sub SetupShapes()
    Dim ws As Worksheet
    Dim shp As Shape
    
    ' Scorre tutti i fogli della cartella di lavoro
    For Each ws In ThisWorkbook.Worksheets
        ' Scorre tutte le forme del foglio
        For Each shp In ws.Shapes
            ' Se la forma ha gi? assegnata una macro (diversa dal wrapper)...
            If shp.OnAction <> "" And shp.OnAction <> "MacroWrapper" Then
                ' Memorizza il nome della macro originale nella propriet? AlternateText
                shp.AlternativeText = shp.OnAction
                ' Imposta il nome della macro da eseguire a: MacroWrapper
                shp.OnAction = "MacroWrapper"
            End If
        Next shp
    Next ws
    
    MsgBox "Le forme sono state aggiornate in modo da utilizzare il wrapper.", vbInformation
End Sub



