VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Questa_cartella_di_lavoro"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
End
Attribute VB_Name = "Questa_cartella_di_lavoro"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
Option Explicit

Private Sub Workbook_Open()
'    Sheets("border?").Activate
'    INDICE.Show
    ' Avvio automatico all'apertura del file
    On Error GoTo GestioneErrore
    VideoGiaAvviato = False
    Call AvviaTimer
    Call VerificaMatch
    Call CaricaFileVideo
    Call Esporta_ElencoBraniStatico_InCSV
    
    Exit Sub

GestioneErrore:
    ' In caso di errore: non blocca Excel, mostra un messaggio e termina l'evento di apertura
    MsgBox "Errore durante l'esecuzione automatica all'apertura (export CSV)." & vbCrLf & _
           Err.Number & " - " & Err.Description, vbExclamation, "Workbook_Open"
End Sub

Private Sub Workbook_Open2()
    PAGINA03.AvviaTimerReport
End Sub

Private Sub Workbook_BeforeClose(Cancel As Boolean)
    Call FermaTimer
    PAGINA03.FermaTimerReport
End Sub



