Attribute VB_Name = "Modulo22"
Attribute VB_Name = "Modulo22"
Sub Classifica()
    Dim wb As Workbook
    Dim wsInput As Worksheet
    Dim wsOutput As Worksheet
    Dim dict As Object
    Dim i As Long
    Dim NomeBrano As String, LivelloBrano As String
    Dim lastRow As Long
    Dim DataArray As Variant
    Dim OutputRow As Long

    ' Apri il file e imposta i fogli di lavoro
    Set wb = Workbooks.Open("L:\DJ Daniel West\LISTA\Bordero` - ver 13.1.59.xlsx")
    'Dim wb As Workbook
    'Set wb = ThisWorkbook
    Set wsInput = wb.Sheets("Accoda Modulo 8+12") ' Foglio origine dei dati
    Set wsOutput = wb.Sheets("Publisher") ' Foglio destinazione per i risultati
    Set dict = CreateObject("Scripting.Dictionary")

    ' Trova l'ultima riga con dati nel foglio origine
    lastRow = wsInput.cells(wsInput.Rows.Count, "A").End(xlUp).Row
    If lastRow < 2 Then
        MsgBox "Nessun dato disponibile per l'elaborazione!", vbExclamation
        Exit Sub
    End If

    ' Analizza i dati dal foglio origine
    For i = 2 To lastRow
        NomeBrano = wsInput.cells(i, 1).Value
        LivelloBrano = wsInput.cells(i, 2).Value

        ' Salta righe con dati mancanti
        If Len(NomeBrano) = 0 Or Len(LivelloBrano) = 0 Then
            MsgBox "Campi vuoti rilevati alla riga " & i & ". Verr? saltata.", vbInformation
            GoTo NextIteration
        End If

        If dict.Exists(NomeBrano) Then
            DataArray = dict(NomeBrano)
            DataArray(1) = DataArray(1) + 1 ' Incrementa il conteggio
            dict(NomeBrano) = DataArray
        Else
            DataArray = Array(LivelloBrano, 1) ' Livello e conteggio iniziale
            dict.Add NomeBrano, DataArray
        End If
NextIteration:
    Next i

    ' Scrivi i risultati nel foglio "Publisher"
    OutputRow = 2
    wsOutput.Range("A1:C1").Value = Array("Nome Brano", "Livello", "Numero Occorrenze")
    wsOutput.Range("A2:C" & wsOutput.Rows.Count).ClearContents ' Pulisce dati preesistenti

    For Each Coreo In dict.keys
        DataArray = dict(Coreo)
        wsOutput.cells(OutputRow, 1).Value = Coreo
        wsOutput.cells(OutputRow, 2).Value = DataArray(0)
        wsOutput.cells(OutputRow, 3).Value = DataArray(1)
        OutputRow = OutputRow + 1
    Next Coreo

    MsgBox "Classifica scritta con successo nel foglio 'Publisher'!", vbInformation
End Sub



