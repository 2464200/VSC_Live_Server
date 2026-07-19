Attribute VB_Name = "Modulo59"
' modWebcamList

Option Explicit

Public Function GetWebcamList() As Collection

    Dim tempFile As String
    tempFile = Environ$("TEMP") & "\devlist.txt"

    Dim Col As New Collection

    Dim cmd As String
    cmd = """" & FFMPEG_PATH & """" & _
          " -list_devices true -f dshow -i dummy > """ & tempFile & """ 2>&1"

    shell "cmd.exe /c " & cmd, vbHide
    Application.Wait Now + TimeValue("0:00:02")

    Dim text As String

    On Error Resume Next
    text = CreateObject("Scripting.FileSystemObject").OpenTextFile(tempFile).ReadAll
    On Error GoTo 0

    Dim lines() As String
    lines = Split(text, vbCrLf)

    Dim i As Long, j As Long

    For i = 0 To UBound(lines)
        If InStr(lines(i), "DirectShow video devices") > 0 Then

            For j = i + 1 To UBound(lines)
                If InStr(lines(j), """") > 0 Then
                    Dim cam As String
                    cam = Trim(Split(lines(j), """")(1))

                    If InStr(1, cam, "Alternative", vbTextCompare) = 0 Then
                        On Error Resume Next
                        Col.Add cam, cam
                        On Error GoTo 0
                    End If
                Else
                    Exit For
                End If
            Next j

            Exit For
        End If
    Next i

    Set GetWebcamList = Col
End Function

