Attribute VB_Name = "Questa_cartella_di_lavoro"
Option Explicit

Private Sub Workbook_Open()
'    Sheets("borderò").Activate
'    INDICE.Show
    On Error GoTo GestioneErrore

    VideoGiaAvviato = False
    Call AvviaTimer
    Call VerificaMatch
    Call CaricaFileVideo
    Call Esporta_ElencoBraniStatico_InCSV

    On Error Resume Next
    PAGINA03.AvviaTimerReport
    On Error GoTo GestioneErrore

    AggiornaTuttiCSV_AllAvvio
    Exit Sub

GestioneErrore:
    MsgBox "Errore durante l'esecuzione automatica all'apertura (export CSV)." & vbCrLf & _
           Err.Number & " - " & Err.Description, vbExclamation, "Workbook_Open"
End Sub

Private Sub Workbook_BeforeClose(Cancel As Boolean)
    Call FermaTimer
    PAGINA03.FermaTimerReport
End Sub

Private Sub AggiornaTuttiCSV_AllAvvio()
    On Error GoTo GestioneErrore
    Application.ScreenUpdating = False
    Application.EnableEvents = False

    EsportaDisplayCSV_DoppioPercorso
    EsportaNextCoreoCSV
    EsportaBorderoCSV
    EsportaLocationCSV
    EsportaLocationPopupOptionsCSV

Uscita:
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    Exit Sub

GestioneErrore:
    MsgBox "Errore aggiornamento CSV all'avvio: " & Err.Description, vbExclamation
    Resume Uscita
End Sub