Attribute VB_Name = "Modulo38"
Sub AvviaGoLive()
    Dim shell As Object
    Dim percorsoVSCode As String
    Dim percorsoCartellaProgetto As String
    Dim comando As String
    
    ' Percorso dell'eseguibile di VS Code (modifica se diverso)
    percorsoVSCode = """""C:\Users\lberetta\AppData\Local\Programs\Microsoft VS Code\Code.exe"""""
    
    ' Cartella del progetto da aprire
    percorsoCartellaProgetto = """C:\VSC_Live_Server"""
    
    ' Comando per aprire VS Code e avviare Live Server
    comando = percorsoVSCode & " " & percorsoCartellaProgetto & " --command liveServer.start"
    
    ' Esegui il comando
    Set shell = CreateObject("WScript.Shell")
    shell.Run comando, 0, False
End Sub

