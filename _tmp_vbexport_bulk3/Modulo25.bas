Attribute VB_Name = "Modulo25"
Attribute VB_Name = "Modulo25"
' Dichiarazione di variabile globale per l'ora pianificata
Dim ScheduledTime As Date

' Funzione per avviare il processo
Sub StartUpdateProcess()
    TimerActive = True ' Questa variabile deve essere dichiarata globalmente se utilizzata altrove
    ScheduledTime = Now + TimeValue("00:03:00") ' Memorizza l'orario pianificato
    Application.OnTime EarliestTime:=ScheduledTime, Procedure:="UpdatePublisherLinks"
End Sub
' Funzione per fermare il processo
Sub StopUpdateProcess()
    On Error Resume Next ' Gestisce errori se ScheduledTime non ? valido
    If ScheduledTime <> 0 Then
        Application.OnTime EarliestTime:=ScheduledTime, Procedure:="UpdatePublisherLinks", Schedule:=False
        ScheduledTime = 0 ' Resetta l'orario pianificato
    End If
    On Error GoTo 0 ' Ripristina la gestione degli errori normale
End Sub



' Aggiornare i collegamenti in Publisher
Sub UpdatePublisherLinks()
    On Error GoTo ErrorHandler
    
    ' Apri o connettiti a Publisher
    If AppPublisher Is Nothing Then
        Set AppPublisher = CreateObject("Publisher.Application")
    End If
    
    ' Percorso del file Publisher
    Dim PublisherFile As String
    PowerPointFile = "I:\Country - Monster Country Group (Bergamo Eventi)\DJ Daniel West\LISTA\show.pptm" ' percorso del file Publisher
    
    ' Percorso del file Excel
    Dim ExcelFile As String
    ExcelFile = ThisWorkbook.FullName ' Percorso completo del file Excel

    
    ' Apri il file Publisher
    Dim PubDoc As Object
    Set PubDoc = AppPublisher.Open(PublisherFile)
    
    ' Esegui l'aggiornamento dei collegamenti (personalizza in base alla struttura)
    ' Qui presupponiamo che i dati siano inseriti come oggetto collegato
    Dim Shape As Object
    For Each Shape In PubDoc.Pages(1).Shapes ' Scorri attraverso tutte le forme nella prima pagina
        If Shape.Type = 14 Then ' Tipo 14 ? un oggetto collegato
            Shape.LinkFormat.Update
        End If
    Next Shape
    
    ' Salva il documento Publisher
    PubDoc.Save
    
    ' Chiudi il documento Publisher
    PubDoc.Close
    
    ' Ripianifica l'aggiornamento se attivo
    If TimerActive Then
        Application.OnTime Now + TimeValue("00:03:00"), "UpdatePublisherLinks"
    End If
    
    Exit Sub
    
ErrorHandler:
    MsgBox "Errore durante l'aggiornamento: " & Err.Description
    StopUpdateProcess
End Sub


