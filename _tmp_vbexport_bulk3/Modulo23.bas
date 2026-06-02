Attribute VB_Name = "Modulo23"
Attribute VB_Name = "Modulo23"
Dim pptPres As Object ' Variabile globale per la presentazione PowerPoint

Sub UpdatePowerPointTable()
    Dim pptApp As Object
    Dim pptSlide As Object
    Dim excelRange As Range
    Dim pastedShape As Object
    
    ' Verifica se la presentazione ? gi? aperta
    If pptPres Is Nothing Then
        ' Apri PowerPoint
        On Error Resume Next
        Set pptApp = GetObject(, "PowerPoint.Application")
        If pptApp Is Nothing Then Set pptApp = CreateObject("PowerPoint.Application")
        On Error GoTo 0
        
        ' Apri la presentazione esistente
        Set pptPres = pptApp.Presentations.Open("I:\Country - Monster Country Group (Bergamo Eventi)\DJ Daniel West\LISTA\show.pptx") ' Modifica il percorso
    End If
    
    ' Accedi alla prima slide
    Set pptSlide = pptPres.Slides(2)
    
    ' Elimina la tabella esistente (opzionale, se necessario)
    Dim shp As Object
    For Each shp In pptSlide.Shapes
        If shp.HasTable Then
            shp.Delete
            Exit For
        End If
    Next shp
    
    ' Definisci l'intervallo di dati in Excel
    Set excelRange = ThisWorkbook.Sheets("Risultati").Range("A1:B7")
    
    ' Copia i dati da Excel
    excelRange.Copy
    
    ' Incolla i dati come nuova tabella nella slide
    pptSlide.Shapes.Paste
    Set pastedShape = pptSlide.Shapes(pptSlide.Shapes.Count)
    
    ' Definisci la posizione e le dimensioni
    With pastedShape
        .Left = 400 ' Posizione orizzontale (in punti)
        .Top = 350 ' Posizione verticale (in punti)
        .width = 200 ' Larghezza (in punti)
        .height = 100 ' Altezza (in punti)
    End With
    
    ' Visualizza PowerPoint, se nascosto
    pptPres.Application.Visible = True
End Sub


