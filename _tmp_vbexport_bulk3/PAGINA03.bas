VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} PAGINA03 
   Caption         =   "frmPagina03"
   ClientHeight    =   12420
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   16770
   OleObjectBlob   =   "PAGINA03.frx":0000
   StartUpPosition =   1  'CenterOwner
End
Attribute VB_Name = "PAGINA03"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Version 5#
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} PAGINA03
   caption = "frmPagina03"
   ClientHeight = 12420
   ClientLeft = 120
   ClientTop = 465
   ClientWidth = 16770
   OleObjectBlob   =   "PAGINA03.frx":0000
   StartUpPosition = 1    'CenterOwner
End
Attribute VB_Name = "PAGINA03"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
' Codice per il form PAGINA03
Private Sub CommandButton31_Click()
    Unload Me
    INDICE.Show
End Sub

Private Sub CommandButton32_Click()
    Unload Me
End Sub

Private Sub CommandButton33_Click()
    Call GeneraReportHTML
Dim ProssimaEsecuzione As Date
End Sub

Public Sub AvviaTimerReport()
    ProssimaEsecuzione = Now + TimeValue("00:03:00")
    Application.OnTime ProssimaEsecuzione, "AggiornaReportHTML"
End Sub

Public Sub FermaTimerReport()
    On Error Resume Next
    Application.OnTime ProssimaEsecuzione, "AggiornaReportHTML", , False
End Sub

Private Sub CommandButton343_Click()
    OpenInChrome "http://127.0.0.1:5500/Prova/Report.html"
End Sub

Private Sub CommandButton344_Click()
    OpenInChrome "http://127.0.0.1:5500/Prova/Report_black.html"
End Sub

Private Sub CommandButton345_Click()
    OpenInChrome "http://127.0.0.1:5500/Prova/Report_white.html"
End Sub

Private Sub CommandButton346_Click()
    GeneraFileSIAE
End Sub

Private Sub UserForm_Initialize()
    ' Definisce il riferimento al foglio
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("Publisher-Show")
    
    ' Collega il contenuto della cella A1 alla casella di testo
    Me.TextBox1.Value = ws.Range("D2").Value
    ' Imposta la dimensione del testo della casella di testo
    Me.TextBox1.Font.Size = 24 ' Puoi modificare il valore a seconda delle tue esigenze
    Me.TextBox1.ForeColor = RGB(255, 0, 0) ' Cambia il colore del testo in rosso
End Sub

Private Sub TextBox1_Change()
    ' Aggiorna la cella quando il contenuto della casella di testo cambia
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("Publisher-Show")
    
    ws.Range("D2").Value = Me.TextBox1.Value
End Sub

Private Sub UserForm03_Initialize()
    Me.caption = "DJ'S BORDERO' - ? 2025 [DJ LUCAS BERRY]"
End Sub

