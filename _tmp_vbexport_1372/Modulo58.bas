Attribute VB_Name = "Modulo58"
' modFFmpegRecorder

Option Explicit

Public CameraName As String
Public RecordPID As Long
Public OutputFile As String

Public BitrateKbps As Long
Public FPS As Long
Public ResolutionText As String


Public Sub StartRecording()

    Dim folder As String
    folder = EnsureTrailingBackslash(SAVE_FOLDER)

    OutputFile = folder & "REC_" & Format(Now, "yyyy-mm-dd_hh-nn-ss") & ".mp4"

    Dim cmd As String
    cmd = """" & FFMPEG_PATH & """" & _
          " -y -f dshow -i video=""" & CameraName & """" & _
          " -vcodec libx264 -preset ultrafast -b:v " & BitrateKbps & "k" & _
          " -s " & ResolutionText & " -r " & FPS & _
          " """ & OutputFile & """"

    RecordPID = shell("cmd.exe /c " & cmd, vbHide)
End Sub


Public Sub StopRecording()
    If RecordPID <> 0 Then
        shell "cmd.exe /c taskkill /PID " & RecordPID & " /F", vbHide
        RecordPID = 0
    End If
End Sub

