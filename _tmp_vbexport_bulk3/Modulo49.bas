Attribute VB_Name = "Modulo49"
Attribute VB_Name = "Modulo49"

Option Explicit

' === Utility: trova Chrome ===
Private Function GetChromePath() As String
    Dim p1 As String, p2 As String
    p1 = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    p2 = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    If Dir(p1) <> "" Then
        GetChromePath = """" & p1 & """"
    ElseIf Dir(p2) <> "" Then
        GetChromePath = """" & p2 & """"
    Else
        GetChromePath = "" ' non trovato
    End If
End Function

' === Verifica raggiungibilit? URL con timeout (HEAD, poi GET in fallback) ===
Public Function IsUrlReachable(ByVal URL As String, Optional ByVal TimeoutMs As Long = 1500) As Boolean
    On Error GoTo Fail
    Dim http As Object
    Set http = CreateObject("MSXML2.XMLHTTP")
    
    ' Prova HEAD per velocit?
    http.Open "HEAD", URL, False
    http.setRequestHeader "Cache-Control", "no-cache"
    http.Send
    If http.Status >= 200 And http.Status < 400 Then
        IsUrlReachable = True
        Exit Function
    End If
    
    ' Fallback: GET rapido (alcuni server non supportano HEAD)
    Set http = CreateObject("MSXML2.XMLHTTP")
    ' Implementa timeout rudimentale via async + attesa
    http.Open "GET", URL, True
    http.setRequestHeader "Cache-Control", "no-cache"
    http.Send
    
    Dim t0 As Single: t0 = Timer
    Do While http.readyState <> 4
        DoEvents
        If (Timer - t0) * 1000 > TimeoutMs Then GoTo Fail
    Loop
    If http.Status >= 200 And http.Status < 400 Then
        IsUrlReachable = True
        Exit Function
    End If
Fail:
    ' Se qualcosa va storto, ritorna False
    If Err.Number <> 0 Then Err.Clear
    IsUrlReachable = False
End Function

' === Apre URL in Chrome se presente, altrimenti nel browser predefinito ===
Public Sub OpenUrlPreferChrome(ByVal URL As String)
    Dim chromePath As String: chromePath = GetChromePath()
    If Len(chromePath) > 0 Then
        shell chromePath & " " & URL, vbNormalFocus
    Else
        ' Browser di default
        ThisWorkbook.FollowHyperlink URL
    End If
End Sub

' === Logica: prova primario, altrimenti fallback ===
Public Sub OpenIndexWithFallback()
    Dim primaryUrl As String, fallbackUrl As String
    primaryUrl = "http://127.0.0.1:5500/index.html"
    fallbackUrl = "http://192.168.1.157:5500/index.html"  ' <-- senza doppio slash
    
    ' Verifica: prima il primario (Live Server locale)
    If IsUrlReachable(primaryUrl, 1500) Then
        OpenUrlPreferChrome primaryUrl
    ElseIf IsUrlReachable(fallbackUrl, 1500) Then
        OpenUrlPreferChrome fallbackUrl
    Else
        MsgBox "Nessuna delle due pagine ? raggiungibile." & vbCrLf & _
               "Verifica che il server sia attivo su 127.0.0.1:5500 o 192.168.1.157:5500.", vbExclamation, "Connessione"
    End If




