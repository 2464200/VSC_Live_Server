VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} PAGINA02 
   Caption         =   "frmPagina02"
   ClientHeight    =   12420
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   16770
   OleObjectBlob   =   "PAGINA02.frx":0000
   StartUpPosition =   1  'CenterOwner
End
Attribute VB_Name = "PAGINA02"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit
' Codice per il form PAGINA02
Private Sub CommandButton31_Click()
    Unload Me
    INDICE.Show
End Sub

Private Sub CommandButton32_Click()
    Unload Me
End Sub

Private Sub UserForm02_Initialize()
    Me.caption = "DJ'S BORDERO' - © 2025 [DJ LUCAS BERRY]"
End Sub
Private Sub UserForm98_Initialize()
    ' Definisce il riferimento al foglio
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("Publisher-Show")
    
    ' Configura e popola il ListBox
    With Me.ListBoxRichieste
        .ColumnCount = 2 ' Numero di colonne
        .RowSource = "Publisher-Show!A1:B20"
        .ColumnHeads = True
        .ColumnWidths = "100 pt;150 pt"

    End With
End Sub

Private Sub Image2_Click()

    ' Apre la pagina in finestra isolata (modalità app), una sola scheda/finestra
    ApriPaginaInChromeSecondoMonitorFullScreen "http://127.0.0.1:5500/prova/logo.html"
End Sub

Private Sub Image3_Click()

    ' Apre la pagina in finestra isolata (modalità app), una sola scheda/finestra
    ApriPaginaInChromeSecondoMonitorFullScreen "http://127.0.0.1:5500/prova/image.html"
End Sub

Sub CambiaColoreTextbox6()

    On Error GoTo GestioneErrore
    
    ' Cambia il colore del testo nella TextBox 6
    frmPagina02.TextBox6.ForeColor = RGB(255, 165, 0) 'Arancione
    
    Exit Sub
    
GestioneErrore:
    MsgBox "Errore nel cambiare il colore del testo: " & Err.Description, vbExclamation

End Sub

Private Sub TextBox6_Change()
    On Error GoTo ErrHandler
    
    Dim frase As String
    frase = Me.TextBox6.text
    
    ' 1) Aggiorna A10 del foglio NEXTCOREO
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("NEXTCOREO")
    
    Application.EnableEvents = False
    ws.Range("A10").Value = frase
    Application.EnableEvents = True
    
    ' 2) Scrive la frase nel file CSV
    WritePhraseToCsv frase
    
    Exit Sub

ErrHandler:
    ' In caso di errore riattiva gli eventi e logga in Finestra Immediata (CTRL+G)
    Application.EnableEvents = True
    Debug.Print "Errore in TextBox6_Change: " & Err.Number & " - " & Err.Description
End Sub

Private Sub CommandButton249_Click()
    ' Apre la pagina in finestra isolata (modalità app), una sola scheda/finestra
    ApriPaginaInChromeSecondoMonitorFullScreen "http://127.0.0.1:5500/servizio.html"
End Sub

Private Sub CommandButton239_Click()
    ' Chiude solo la finestra aperta sopra
    ChiudiChromeApertoDaMacro
End Sub

