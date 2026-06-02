Attribute VB_Name = "Modulo61"
Attribute VB_Name = "Modulo61"
' modTimer

Option Explicit

Public Sub TimerLoop()
    If PAGINA07.IsRecording Then
        PAGINA07.LabelTimer.caption = Format(Now - PAGINA07.RecTimer, "hh:mm:ss")
        Application.OnTime Now + TimeValue("0:00:01"), "TimerLoop"
    End If
End Sub


Public Sub FlashRec()
    If PAGINA07.IsRecording Then
        PAGINA07.FlashState = Not PAGINA07.FlashState
        PAGINA07.LabelREC.Visible = PAGINA07.FlashState
        Application.OnTime Now + TimeValue("0:00:00.5"), "FlashRec"
    End If
End Sub

