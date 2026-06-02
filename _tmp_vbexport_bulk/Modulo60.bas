Attribute VB_Name = "Modulo60"
' modConfig

Option Explicit

' === PERCORSI GLOBALI ACCESSIBILI A TUTTI ===
Public Const FFMPEG_PATH As String = "C:\FFMPEG\bin\ffmpeg.exe"
Public Const SAVE_FOLDER As String = "c:\vsc_webcam\"
Public Const VLC_PATH As String = "C:\Program Files (x86)\VideoLAN\VLC\vlc.exe"

' Aggiunge lo slash finale se manca
Public Function EnsureTrailingBackslash(ByVal p As String) As String
    If Len(p) > 0 And Right$(p, 1) <> "\" Then
        EnsureTrailingBackslash = p & "\"
    Else
        EnsureTrailingBackslash = p
    End If
End Function
