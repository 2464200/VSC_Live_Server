VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Foglio14"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
End
Attribute VB_Name = "Foglio14"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True

Option Explicit

' Questo evento scatta quando qualsiasi cella del foglio cambia.
Private Sub Worksheet_Change(ByVal Target As Range)
    On Error GoTo ErrHandler
    
    ' Controlla se ? stata modificata la cella A1
    If Not Intersect(Target, Me.Range("A1")) Is Nothing Then
        Application.EnableEvents = False  ' evita loop ricorsivi nel caso la macro modifichi celle
        
    End If
    
ExitPoint:
    Application.EnableEvents = True
    Exit Sub

ErrHandler:
    ' Fallback: riabilita eventi anche in caso di errore
    Resume ExitPoint
End Sub

 

