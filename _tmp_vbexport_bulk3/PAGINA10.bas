VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} PAGINA10 
   Caption         =   "frmPAGINA10"
   ClientHeight    =   12420
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   16770
   OleObjectBlob   =   "PAGINA10.frx":0000
   StartUpPosition =   1  'CenterOwner
End
Attribute VB_Name = "PAGINA10"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Version 5#
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} PAGINA10
   caption = "frmPAGINA10"
   ClientHeight = 12420
   ClientLeft = 120
   ClientTop = 465
   ClientWidth = 16770
   OleObjectBlob   =   "PAGINA10.frx":0000
   StartUpPosition = 1    'CenterOwner
End
Attribute VB_Name = "PAGINA10"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

' ============================================================
' USERFORM PAGINA10 ? CONTROLLO DASH + UI
' ============================================================

' ------------------------------------------------------------
' Pulsante TORNA A INDICE
' ------------------------------------------------------------
Private Sub CommandButton31_Click()
    Me.Hide          ' NON usare Unload
    INDICE.Show
End Sub

' ------------------------------------------------------------
' Pulsante CHIUDI FORM
' ------------------------------------------------------------
Private Sub CommandButton32_Click()
    Me.Hide          ' NON usare Unload
End Sub


' ------------------------------------------------------------
' START DASH (AutoHotkey)
' CommandButton33
' ------------------------------------------------------------
Private Sub CommandButton33_Click()
    On Error GoTo GestioneErrore
    AvviaDashLoop
    Exit Sub
GestioneErrore:
    MsgBox "Errore avvio DASH:" & vbCrLf & Err.Description, vbCritical
End Sub


' ------------------------------------------------------------
' STOP DASH (AutoHotkey)
' CommandButton34
' ------------------------------------------------------------
Private Sub CommandButton34_Click()
    On Error GoTo GestioneErrore
    FermaDashLoop
    Exit Sub
GestioneErrore:
    MsgBox "Errore stop DASH:" & vbCrLf & Err.Description, vbCritical
End Sub


' ------------------------------------------------------------
' START AGGIORNAMENTO TEXTBOX (UI)
' ------------------------------------------------------------
Private Sub cmdStartUI_Click()
    On Error GoTo GestioneErrore
    StartTextBoxTimer
    Exit Sub
GestioneErrore:
    MsgBox "Errore avvio UI:" & vbCrLf & Err.Description, vbCritical
End Sub


' ------------------------------------------------------------
' STOP AGGIORNAMENTO TEXTBOX (UI)
' ------------------------------------------------------------
Private Sub cmdStopUI_Click()
    On Error GoTo GestioneErrore
    StopTextBoxTimer
    Exit Sub
GestioneErrore:
    MsgBox "Errore stop UI:" & vbCrLf & Err.Description, vbCritical
End Sub


' ------------------------------------------------------------
' AVVIO AUTOMATICO UI QUANDO IL FORM SI APRE
' ?? QUESTO ERA IL PEZZO MANCANTE
' ------------------------------------------------------------
Private Sub UserForm_Initialize()
    StartTextBoxTimer
End Sub


' ------------------------------------------------------------
' CHIUSURA SICURA
' ------------------------------------------------------------
Private Sub UserForm_Terminate()
    On Error Resume Next
    StopTextBoxTimer
    FermaDashLoop
End Sub

