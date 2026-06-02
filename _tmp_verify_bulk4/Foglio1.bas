VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Foglio1"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
Option Explicit

Private Sub btnPlayX_Click()
    If MatchAttivo = True Then
        Call AvviaVideo
    End If
End Sub
    
Private Sub btnPlayX_DblClick(ByVal Cancel As MSForms.ReturnBoolean)
    If MatchAttivo = True Then
        Call AvviaVideo
    End If
End Sub
    
Private Sub btnStopVideo_Click()
        Call StopVideo
End Sub
Private Sub Worksheet_Change(ByVal Target As Range)
    Dim lastRow As Long
    With Me
        lastRow = .cells(.Rows.Count, "A").End(xlUp).Row
        If lastRow < 11 Then Exit Sub
        If Intersect(Target, .Range("A11:A" & lastRow)) Is Nothing Then Exit Sub
        On Error Resume Next
        Application.EnableEvents = False
        If Target <> "" Then
            .cells(Target.Row, Target.Column + 1).Value = Now
        End If
        Application.EnableEvents = True
    End With
    'VerificaMatchEAggiornaStato
End Sub
