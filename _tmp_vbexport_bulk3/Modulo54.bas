Attribute VB_Name = "Modulo54"
Attribute VB_Name = "Modulo54"

Function GetCameraName() As String
    GetCameraName = ThisWorkbook.Sheets("dBase").Range("E134").Value
End Function

Public Sub AggiornaReportHTML()
    GeneraReportHTML
    PAGINA03.AvviaTimerReport
End Sub


