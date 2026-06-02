VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} PAGINA08 
   Caption         =   "frmPAGINA08"
   ClientHeight    =   12420
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   16770
   OleObjectBlob   =   "PAGINA08.frx":0000
   StartUpPosition =   1  'CenterOwner
End
Attribute VB_Name = "PAGINA08"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Private Sub CommandButton1073_Click()
    'CommandButton1073.Picture = LoadPicture("C:\VSC_Live_Server\archivio\LINK FORM LISTA (8) SLIDE.jpg")
    ' URL internet
    OpenInChrome "http://127.0.0.1:5500/ScriptPDF1.html"
End Sub

Private Sub CommandButton1074_Click()
    'CommandButton1074.Picture = LoadPicture("C:\VSC_Live_Server\archivio\LINK FORM LISTA (8) SLIDE.jpg")
    ' URL internet
    OpenInChrome "http://127.0.0.1:5500/prova/ScriptPDF1.html"
End Sub

Private Sub CommandButton31_Click()
    Unload Me
    INDICE.Show
End Sub

Private Sub CommandButton32_Click()
    Unload Me
End Sub

