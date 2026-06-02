Attribute VB_Name = "Modulo46"
Attribute VB_Name = "Modulo46"


Option Explicit

' Variabile globale per ricordare il PID di Chrome aperto dal bottone "Pubblica"
Public gChromePID As Long

' === Trova il percorso di Chrome se non fornito ===
Public Function GetChromePath() As String
    On Error Resume Next
    Dim p As String
    
    ' Percorsi comuni
    p = Environ$("ProgramFiles") & "\Google\Chrome\Application\chrome.exe"
    If Len(Dir$(p)) > 0 Then GetChromePath = p: Exit Function
    
    p = Environ$("ProgramFiles(x86)") & "\Google\Chrome\Application\chrome.exe"
    If Len(Dir$(p)) > 0 Then GetChromePath = p: Exit Function
    
    ' Utente (installazione per-user)
    p = Environ$("LocalAppData") & "\Google\Chrome\Application\chrome.exe"
    If Len(Dir$(p)) > 0 Then GetChromePath = p: Exit Function
    
    ' Se non trovato, vuoto
    GetChromePath = ""
End Function

' === Apre Chrome su URL e cerca il PID della tab col medesimo URL ===
' Restituisce il PID della tab/istanza trovata, altrimenti 0.
Public Function OpenInChrome2(ByVal URL As String) As Long
    On Error GoTo Fallisci
    
    Dim chrome As String
    chrome = GetChromePath()
    If chrome = "" Then
        ' Prova a usare associazione predefinita (senza percorso)
        shell "cmd.exe /c start """" chrome """ & URL & """", vbHide
    Else
        shell """" & chrome & """ """ & URL & """", vbNormalFocus
    End If
    
    ' Attendi un attimo che il processo appaia
    Dim t As Single
    t = Timer
    Do While Timer - t < 3
        DoEvents
    Loop
    
    ' Trova il PID del processo di chrome con commandline che contiene l'URL
    OpenInChrome2 = FindChromePidByUrl(URL)
    Exit Function

Fallisci:
    OpenInChrome2 = 0
End Function

' === Cerca il PID di chrome.exe la cui commandline contiene l'URL ===
' Richiede WMI (presente di default su Windows).
Public Function FindChromePidByUrl(ByVal URL As String) As Long
    On Error GoTo Fallisci
    
    Dim svc As Object, procs As Object, p As Object
    Set svc = GetObject("winmgmts:\\.\root\cimv2")
    Set procs = svc.ExecQuery("SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name='chrome.exe'")
    
    Dim foundPid As Long
    foundPid = 0
    
    For Each p In procs
        ' Alcune istanze hanno CommandLine = Null
        If Not IsNull(p.CommandLine) Then
            If InStr(1, p.CommandLine, URL, vbTextCompare) > 0 Then
                foundPid = CLng(p.ProcessID)
                Exit For
            End If
        End If
    Next
    
    FindChromePidByUrl = foundPid
    Exit Function

Fallisci:
    FindChromePidByUrl = 0
End Function

' === Chiude l'intero albero del processo (Chrome e figli) ===
Public Sub KillProcessTree(ByVal pid As Long)
    On Error Resume Next
    ' /T = kill process tree, /F = force
    shell "cmd.exe /c taskkill /PID " & CStr(pid) & " /T /F", vbHide
End Sub


