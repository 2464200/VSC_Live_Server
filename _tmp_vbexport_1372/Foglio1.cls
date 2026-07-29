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

    Call VerificaMatch

    If MatchAttivo Then

        Call AvviaVideo

    Else

        MsgBox "Video non trovato per la coreografia selezionata.", vbExclamation

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
    If Intersect(Target, Range("$A$12:$A$612")) Is Nothing Then Exit Sub
    On Error Resume Next
    Application.EnableEvents = False
    
    If Target.Value <> "" Then
        ' Se la cella A ha un valore, inserisci data/ora in B
        cells(Target.Row, Target.Column + 1) = Now
    Else
        ' Se la cella A è vuota, svuota anche B
        cells(Target.Row, Target.Column + 1) = ""
    End If
    
    Application.EnableEvents = True
End Sub

