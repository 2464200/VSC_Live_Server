Attribute VB_Name = "Modulo53"
'REGISTRA DA WEBCAM ex "USB Camera" ora GetCameraName(), SALVA IVIDEO, LI RIPRODUCE

Option Explicit

Public ffmpegPID As Long
Public recordingFile As String
Public fileCounter As Long

Sub StartRecording()
    Dim FFmpegPath As String, savePath As String, cmd As String
    Dim timestamp As String
    
    FFmpegPath = """C:\ffmpeg\bin\ffmpeg.exe""" ' <-- percorso ffmpeg
    savePath = "c:\vsc_webcam\"
    
    If Dir(savePath, vbDirectory) = "" Then MkDir savePath
    
    fileCounter = fileCounter + 1
    timestamp = Format(Now, "yyyy-mm-dd-hh-nn-ss")
    recordingFile = savePath & Format(900 + fileCounter, "000") & "-" & timestamp & ".mp4"
    
    ' Comando ffmpeg
    cmd = FFmpegPath & " -f dshow -i video=""GetCameraName()"" -vcodec libx264 -preset ultrafast """ & recordingFile & """"
    
    ffmpegPID = shell(cmd, vbHide)
End Sub

Sub StopRecording()
    ' Termina ffmpeg
    If ffmpegPID <> 0 Then
        shell "taskkill /PID " & ffmpegPID & " /F", vbHide
        ffmpegPID = 0
    End If
    Call UpdateFileList
End Sub

Sub UpdateFileList()
    Dim f As String
    PAGINA05.ComboBox1.Clear
    f = Dir("c:\vsc_webcam\*.mp4")
    Do While f <> ""
        PAGINA05.ComboBox1.AddItem f
        f = Dir
    Loop
End Sub

Sub PlayVideoOnSecondMonitor(fileName As String)
    Dim vlcPath As String, VideoPath As String, cmd As String
    
    ' Percorso VLC
    vlcPath = """C:\Program Files\VideoLAN\VLC\vlc.exe"""
    
    ' Percorso completo del file video
    VideoPath = """c:\vsc_webcam\" & fileName & """"
    
    ' Comando VLC con parametri ottimizzati
    cmd = vlcPath & " --fullscreen --qt-fullscreen-screennumber=1 --no-video-title-show --file-caching=3000 --play-and-exit " & VideoPath
    
    ' Avvia VLC
    shell cmd, vbHide
End Sub

