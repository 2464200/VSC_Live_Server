Attribute VB_Name = "Modulo48"
Attribute VB_Name = "Modulo48"

Option Explicit

' Variabili globali per tracciare l'istanza isolata
Private gChromePID As Long
Private gUserDataDir As String

' Trova il percorso di Chrome (x64 / x86)
Private Function GetChromePath() As String
    Dim p1 As String, p2 As String
    p1 = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    p2 = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    
    If Dir(p1) <> "" Then
        GetChromePath = """" & p1 & """"
    ElseIf Dir(p2) <> "" Then
        GetChromePath = """" & p2 & """"
    Else
        Err.Raise 53, , "Chrome non trovato. Verifica l'installazione."
    End If
End Function

' Apre l'URL in un'istanza isolata di Chrome, in modalit? app (una sola finestra, senza tab)
Public Sub OpenInChrome_IsolatedApp(ByVal URL As String)
    Dim chrome As String: chrome = GetChromePath()
    
    ' Crea una cartella profilo temporanea (univoca)
    gUserDataDir = Environ$("TEMP") & "\Chrome_Isolated_" & Format(Now, "yyyymmdd_hhnnss")
    
    ' Avvia Chrome in modalit? app, con profilo isolato
    Dim args As String
    args = " --user-data-dir=""" & gUserDataDir & _
           """ --app=""" & URL & _
           """ --no-first-run --no-default-browser-check"
    
    ' Avvio e memorizzazione del PID (se disponibile)
    gChromePID = shell(chrome & args, vbNormalFocus)
End Sub

' Chiude SOLO l'istanza isolata (quella aperta sopra) senza toccare le altre
Public Sub CloseIsolatedChrome()
    On Error GoTo CleanExit
    
    If Len(gUserDataDir) = 0 Then
        ' Non abbiamo traccia di una finestra isolata da chiudere
        Exit Sub
    End If
    
    ' 1) Prova a individuare (via WMI) i processi chrome.exe con quel user-data-dir
    Dim svc As Object, procs As Object, p As Object
    Set svc = GetObject("winmgmts:\\.\root\cimv2")
    Set procs = svc.ExecQuery("SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name='chrome.exe'")
    
    For Each p In procs
        ' CommandLine pu? essere Null, concateno stringa vuota per sicurezza
        If InStr(1, (p.CommandLine & vbNullString), gUserDataDir, vbTextCompare) > 0 Then
            ' Termina il processo dell'istanza isolata
            p.Terminate
        End If
    Next p
    
    ' 2) Fallback: se abbiamo un PID, prova anche con taskkill (opzionale)
    If gChromePID > 0 Then
        shell "cmd /c taskkill /F /PID " & CStr(gChromePID), vbHide
    End If

CleanExit:
    ' Reset variabili
    gChromePID = 0
    gUserDataDir = ""
End Sub




