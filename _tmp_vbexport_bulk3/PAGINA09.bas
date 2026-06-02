VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} PAGINA09 
   Caption         =   "frmPAGINA09"
   ClientHeight    =   12420
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   16770
   OleObjectBlob   =   "PAGINA09.frx":0000
   StartUpPosition =   1  'CenterOwner
End
Attribute VB_Name = "PAGINA09"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Version 5#
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} PAGINA09
   caption = "frmPAGINA09"
   ClientHeight = 12420
   ClientLeft = 120
   ClientTop = 465
   ClientWidth = 16770
   OleObjectBlob   =   "PAGINA09.frx":0000
   StartUpPosition = 1    'CenterOwner
End
Attribute VB_Name = "PAGINA09"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Private Sub CommandButton63_Click()
    'CommandButton63.Picture = LoadPicture("C:\VSC_Live_Server\archivio\LINK FORM LISTA (8) SLIDE.jpg")
    ' URL internet
    OpenInChrome "http://127.0.0.1:5500/Eventi/public/eventi.html"
End Sub

Private Sub CommandButton31_Click()
    Unload Me
    INDICE.Show
End Sub

Private Sub CommandButton32_Click()
    Unload Me
End Sub



