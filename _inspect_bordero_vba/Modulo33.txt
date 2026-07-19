Attribute VB_Name = "Modulo33"

'--- Trova il percorso di Chrome leggendo il Registro
Public Function GetChromePath() As String
    On Error Resume Next
    Dim wsh As Object
    Set wsh = CreateObject("WScript.Shell")
    ' Prova in HKLM
    GetChromePath = wsh.RegRead("HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe\")
    ' Se non trovato, prova in HKCU
    If Len(GetChromePath) = 0 Then
        GetChromePath = wsh.RegRead("HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe\")
    End If
End Function

'--- Apre un URL o un file .html in una nuova finestra di Chrome
Public Sub OpenInChrome(ByVal Target As String)
    Dim chrome As String
    chrome = GetChromePath()
    If Len(chrome) = 0 Then
        MsgBox "Chrome non trovato. Imposta Chrome o usa il browser predefinito.", vbExclamation
        Exit Sub
    End If

    ' Attenzione alle virgolette per percorsi con spazi
    Dim cmd As String
    cmd = """" & chrome & """" & " --new-window--kiosk " & """" & Target & """"
    shell cmd, vbNormalFocus
End Sub

