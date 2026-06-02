Attribute VB_Name = "Modulo2"
Attribute VB_Name = "Modulo2"
Sub copia_data_B9()
'MACRO9 Macro
    Range("$B$9").Select
    Selection.Copy
    Range("$C$9").Select
    Selection.PasteSpecial Paste:=xlPasteValues, Operation:=xlNone, SkipBlanks _
        :=False, Transpose:=False
    Application.CutCopyMode = False
    ActiveWorkbook.Save
End Sub


