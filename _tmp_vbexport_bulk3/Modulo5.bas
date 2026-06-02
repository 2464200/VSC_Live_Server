Attribute VB_Name = "Modulo5"
Attribute VB_Name = "Modulo5"
Sub vai_alla_fine()
Attribute vai_alla_fine.VB_Description = "vai alla fine dei brani, dove trovi quelli gi? eseguiti"
Attribute vai_alla_fine.VB_ProcData.VB_Invoke_Func = " \n14"
'
' vai_alla_fine Macro
' vai alla fine dei brani, dove trovi quelli gi? eseguiti
'

'
    Range("$C$11").Select
    Selection.End(xlDown).Select
End Sub

