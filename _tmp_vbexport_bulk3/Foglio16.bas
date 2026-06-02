VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Foglio16"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
End
Attribute VB_Name = "Foglio16"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
Option Explicit

Private Sub Worksheet_Change(ByVal Target As Range)
    If Not Intersect(Target, Me.Range("A1")) Is Nothing Then
        Call VerificaMatch
        'Call CaricaFileVideoEVerifica
        'Application.EnableEvents = False
        'AggiornaStatoPulsante
        'Application.EnableEvents = True
        'VerificaMatchEAggiornaStato
    End If

End Sub

Private Sub btnPlayX_Click()
    If Not gBtnAbilitato Then Exit Sub
    AvviaVideo
End Sub


