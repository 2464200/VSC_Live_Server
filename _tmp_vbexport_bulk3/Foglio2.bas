VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Foglio2"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
End
Attribute VB_Name = "Foglio2"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True

Private Sub UserForm_Initialize()
    Dim ws As Worksheet
    Dim rng As Range
    Dim cell As Range

    Set ws = ThisWorkbook.Sheets("dBase")
    Set rng = ws.Range("A137:A147")

    ComboBox2.Clear
    For Each cell In rng
        If cell.Value <> "" Then
            ComboBox2.AddItem cell.Value
        End If
    Next cell
End Sub


