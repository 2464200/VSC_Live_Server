Attribute VB_Name = "Modulo20"
Sub Videoproiettore()
Attribute Videoproiettore.VB_Description = "Trasmette al Videoproiettore il foglio Word con il nome della coreografia"
Attribute Videoproiettore.VB_ProcData.VB_Invoke_Func = " \n14"
'
' Videoproiettore Macro
' Trasmette al Videoproiettore il foglio Word con il nome della coreografia
'
    Set wordApp = CreateObject("Word.Application")
    Set wordDoc = wordApp.Documents.Add
    wordApp.Visible = True
    wordApp.Application.Activate
        With wordApp.Selection
        .Font.name = "arial"
        .Font.Size = 52
        .Font.Underline = True
        .Font.Color = vbRed
        .ParagraphFormat.Alignment = wdAlignParagraphCenter
    End With
    wordApp.Selection.typetext ("Testo inserito con Excel")
' WordApp.Selection.typetext Text:=(D7)
' WordApp.Selection.typetext Text:=Range("d29:d29")
' WordApp.Application.PrintOut
End Sub
Sub Videoproiettore_close()
Attribute Videoproiettore_close.VB_Description = "Chiude Word"
Attribute Videoproiettore_close.VB_ProcData.VB_Invoke_Func = " \n14"
'
' Videoproiettore_close Macro
' Chiude Word
'

'
'Per *uscire* da Word:

'Public Sub m()
'Application.Quit
'End Sub

'Per chiudere il documento:

'Public Sub m()
'ThisDocument.Close
'End Sub


If WordWasNotRunning Then
    wordApp.Quit
End If
End Sub

