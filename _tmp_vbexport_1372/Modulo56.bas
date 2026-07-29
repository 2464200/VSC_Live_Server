Attribute VB_Name = "Modulo56"
Option Explicit

' Percorsi dei programmi
Const FFMPEG_PATH As String = "C:\FFMPEG\bin\ffmpeg.exe"
Const SAVE_FOLDER As String = "c:\vsc_webcam\"
Const VLC_PATH As String = "C:\Program Files (x86)\VideoLAN\VLC\vlc.exe"

' Nome esatto della webcam (modifica se necessario)
Const CAMERA_NAME As String = "USB Camera"

' Variabili interne
Public ffmpegPID As Long
Public OutputFile As String

' Avvia registrazione video
Public Sub StartRecording1000()

    ' Crea il nome file con timestamp
    OutputFile = SAVE_FOLDER & "recording_" & Format(Now, "yyyy-mm-dd_hh-nn-ss") & ".mp4"

    ' Comando FFmpeg
    Dim cmd As String
    cmd = """" & FFMPEG_PATH & """" _
        & " -f dshow -i video=""" & CAMERA_NAME & """" _
        & " -vcodec libx264 -preset ultrafast " _
        & """" & OutputFile & """"

    ' Avvia processo FFmpeg invisibile
    ffmpegPID = shell("cmd.exe /c " & cmd, vbHide)

    MsgBox "Registrazione avviata!" & vbCrLf & OutputFile, vbInformation

End Sub

' Ferma registrazione
Public Sub StopRecording1000()

    If ffmpegPID = 0 Then
        MsgBox "Nessuna registrazione in corso.", vbExclamation
        Exit Sub
    End If

    ' Termina il processo FFmpeg
    shell "cmd.exe /c taskkill /PID " & ffmpegPID & " /F", vbHide

    ffmpegPID = 0

    MsgBox "Registrazione terminata!" & vbCrLf & "File salvato in:" & vbCrLf & OutputFile, vbInformation

End Sub

' (OPZIONALE) Apri l'ultimo video in VLC
Public Sub OpenLastVideo()

    If Len(Dir(OutputFile)) = 0 Then
        MsgBox "Nessun video registrato da aprire.", vbExclamation
        Exit Sub
    End If

    shell """" & VLC_PATH & """ """ & OutputFile & """", vbNormalFocus

End Sub

