Attribute VB_Name = "Modulo37"
Option Explicit

' Variabili globali per i processi con NODE.JS
Public pidLiveServer As Long
Public pidChrome As Long

' Percorsi configurabili
Public Const percorsoCartella As String = "C:\VSC_Live_Server"
Public Const percorsoChrome As String = "C:\Program Files\Google\Chrome\Application\chrome.exe"

Sub AvviaLiveServerChrome()
    Dim URL As String
    Dim tempProfile As String
    
    ' URL della pagina servita da Live Server
    URL = "http://google.it"
    
    ' Cartella temporanea per il profilo isolato di Chrome
    tempProfile = Environ("TEMP") & "\ChromeTempProfile"
    
    ' 1?? Avvia live-server sulla cartella
    pidLiveServer = shell("""C:\Users\lberetta\AppData\Local\Programs\Microsoft VS Code\code.exe"" ""C:\VSC_Live_Server\index.html""", vbNormalFocus)
    
    ' Attendere qualche secondo per assicurare avvio server
    Application.Wait Now + TimeValue("00:00:03")
    
    ' 2?? Avvia Chrome in profilo temporaneo a schermo intero
    pidChrome = shell("""" & percorsoChrome & """ --user-data-dir=""" & tempProfile & """ --start-fullscreen " & URL, vbNormalFocus)
    
    MsgBox "Live Server e Chrome avviati. Premi il pulsante 'Chiudi Live Server' per terminare.", vbInformation
End Sub

Sub ChiudiLiveServerChrome()
    On Error Resume Next
    Dim fso As Object
    Dim tempProfile As String
    
    ' 1?? Chiudi Chrome
    If pidChrome <> 0 Then
        shell "taskkill /F /PID " & pidChrome, vbHide
    End If
    
    ' 2?? Chiudi live-server
    If pidLiveServer <> 0 Then
        shell "taskkill /F /PID " & pidLiveServer, vbHide
    End If
    
    ' 3?? Pulizia cartella temporanea profilo Chrome
    tempProfile = Environ("TEMP") & "\ChromeTempProfile"
    Set fso = CreateObject("Scripting.FileSystemObject")
    If fso.FolderExists(tempProfile) Then
        fso.DeleteFolder tempProfile, True
    End If
    
    MsgBox "Live Server e Chrome chiusi. Tornando a Excel.", vbInformation
End Sub

