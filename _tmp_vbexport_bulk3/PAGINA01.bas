VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} PAGINA01 
   Caption         =   "frmPagina01"
   ClientHeight    =   12420
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   16770
   OleObjectBlob   =   "PAGINA01.frx":0000
   StartUpPosition =   1  'CenterOwner
End
Attribute VB_Name = "PAGINA01"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Version 5#
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} PAGINA01
   caption = "frmPagina01"
   ClientHeight = 12420
   ClientLeft = 120
   ClientTop = 465
   ClientWidth = 16770
   OleObjectBlob   =   "PAGINA01.frx":0000
   StartUpPosition = 1    'CenterOwner
End
Attribute VB_Name = "PAGINA01"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
' Codice per il form PAGINA01
Private Sub CommandButton31_Click()
    Unload Me
    INDICE.Show
End Sub

Private Sub CommandButton32_Click()
    Unload Me
End Sub

Private Sub Prova_Click()
    Btn_Prova_click       ' Chiama la subroutine che apre il PDF
End Sub

Private Sub UserForm_Initialize()
    Dim ws As Worksheet
    Dim intervallo As Range
    Dim cella As Range
    
    ' Imposta il riferimento al foglio di lavoro
    Set ws = ThisWorkbook.Sheets("dBase")
    
    ' Definisci l'intervallo delle celle
    Set intervallo = ws.Range("A1:A3")
    
    ' Aggiungi i dati all'interno del ComboBox1
    For Each cella In intervallo
        If cella.Value <> "" Then ' Evita celle vuote
            ComboBox1.AddItem cella.Value
        End If
    Next cella
End Sub

Private Sub UserForm2_Initialize()
    Dim ws As Worksheet
    Dim intervallo As Range
    Dim cella As Range
    
    ' Imposta il riferimento al foglio di lavoro
    Set ws = ThisWorkbook.Sheets("ComuniItalia")
    
    ' Definisci l'intervallo delle celle
    Set intervallo = ws.Range("F1772:F2000")
    
    ' Aggiungi i dati all'interno del ComboBox2
    For Each cella In intervallo
        If cella.Value <> "" Then ' Evita celle vuote
            ComboBox1.AddItem cella.Value
        End If
    Next cella
End Sub
Private Sub UserForm01_Initialize()
    Me.caption = "DJ'S BORDERO' - ? 2025 [DJ LUCAS BERRY]"
End Sub

