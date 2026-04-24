
' Modulo VBA per Excel - Integrazione con ScriptPDF1
' Copia questo codice in un modulo VBA di Excel

' ============================================================
' SOTTOSCRITTI PUBBLICI
' ============================================================

Public WithEvents chrome_Process As Object
Public pdf_server_Process As Object

' ============================================================
' SUB: ApriGestorePDF
' Descrizione: Apre la gestione PDF in una finestra Chrome
' ============================================================

Sub ApriGestorePDF()
    Dim shell As Object
    Dim scriptPath As String
    Dim excelApp As Object
    Dim excelHwnd As Long
    
    On Error GoTo ErrHandler
    
    Set shell = CreateObject("WScript.Shell")
    Set excelApp = GetObject("winmgr:").ExecQuery("Select * from Win32_Process Where Name='EXCEL.EXE'")
    
    ' Percorso dello script PowerShell
    scriptPath = "C:\VSC_Live_Server\Start_ScriptPDF1.ps1"
    
    ' Verifica che lo script esista
    If Dir(scriptPath) = "" Then
        MsgBox "Errore: Script non trovato in " & scriptPath, vbExclamation, "Gestione PDF"
        Exit Sub
    End If
    
    ' Esegui lo script PowerShell
    MsgBox "Apertura della gestione PDF..." & vbCrLf & vbCrLf & _
           "Se è la prima volta, l'installazione potrebbe richiedere alcuni secondi.", _
           vbInformation, "Gestione PDF"
    
    shell.Run "powershell -NoProfile -ExecutionPolicy Bypass -File """ & scriptPath & """", , True
    
    MsgBox "Sessione PDF terminata. Tornando a Excel.", vbInformation, "Gestione PDF"
    ExitSub:
        Set shell = Nothing
        Exit Sub
    
    ErrHandler:
        MsgBox "Errore: " & Err.Number & " - " & Err.Description, vbExclamation, "Gestione PDF"
        GoTo ExitSub
End Sub

' ============================================================
' SUB: ApriGestorePDF_Async
' Descrizione: Apre la gestione PDF in background (non bloccante)
' Nota: Per un'apertura più veloce senza attendere
' ============================================================

Sub ApriGestorePDF_Async()
    Dim shell As Object
    Dim scriptPath As String
    
    On Error GoTo ErrHandler
    
    Set shell = CreateObject("WScript.Shell")
    
    ' Percorso dello script PowerShell
    scriptPath = "C:\VSC_Live_Server\Start_ScriptPDF1.ps1"
    
    ' Verifica che lo script esista
    If Dir(scriptPath) = "" Then
        MsgBox "Errore: Script non trovato in " & scriptPath, vbExclamation, "Gestione PDF"
        Exit Sub
    End If
    
    ' Esegui lo script PowerShell in background
    shell.Run "powershell -NoProfile -ExecutionPolicy Bypass -File """ & scriptPath & """", , False
    
    MsgBox "Gestione PDF avviata" & vbCrLf & vbCrLf & _
           "Verrai notificato quando la sessione terminerà.", _
           vbInformation, "Gestione PDF"
    
    ExitSub:
        Set shell = Nothing
        Exit Sub
    
    ErrHandler:
        MsgBox "Errore: " & Err.Number & " - " & Err.Description, vbExclamation, "Gestione PDF"
        GoTo ExitSub
End Sub

' ============================================================
' SUB: ConfiguraGestorePDF
' Descrizione: Esegue il setup iniziale
' ============================================================

Sub ConfiguraGestorePDF()
    Dim shell As Object
    Dim scriptPath As String
    Dim setupScript As String
    
    On Error GoTo ErrHandler
    
    Set shell = CreateObject("WScript.Shell")
    
    ' Percorso dello script di setup
    setupScript = "C:\VSC_Live_Server\Setup_ScriptPDF1.ps1"
    
    ' Verifica che lo script esista
    If Dir(setupScript) = "" Then
        MsgBox "Errore: Script di setup non trovato", vbExclamation, "Configurazione PDF"
        Exit Sub
    End If
    
    MsgBox "Verrà eseguita la configurazione iniziale..." & vbCrLf & vbCrLf & _
           "Questo processo:" & vbCrLf & _
           "• Verifica Node.js" & vbCrLf & _
           "• Installa le dipendenze npm" & vbCrLf & _
           "• Crea la cartella C:\VSC_SCRIPT_PDF" & vbCrLf & _
           "• Verifica Google Chrome", _
           vbInformation, "Configurazione"
    
    ' Esegui lo script di setup
    shell.Run "powershell -NoProfile -ExecutionPolicy Bypass -File """ & setupScript & """", , True
    
    ExitSub:
        Set shell = Nothing
        Exit Sub
    
    ErrHandler:
        MsgBox "Errore: " & Err.Number & " - " & Err.Description, vbExclamation, "Configurazione PDF"
        GoTo ExitSub
End Sub

' ============================================================
' SUB: ApriCartellaScriptPDF
' Descrizione: Apre la cartella C:\VSC_SCRIPT_PDF in Esplora file
' ============================================================

Sub ApriCartellaScriptPDF()
    Dim shell As Object
    Dim pdfFolder As String
    
    On Error GoTo ErrHandler
    
    Set shell = CreateObject("WScript.Shell")
    pdfFolder = "C:\VSC_SCRIPT_PDF"
    
    ' Verifica che la cartella esista
    If Dir(pdfFolder, vbDirectory) = "" Then
        If MsgBox("La cartella non esiste." & vbCrLf & "Vuoi crearla?", vbYesNo, "Gestione PDF") = vbYes Then
            CreateObject("WScript.Shell").Run "powershell New-Item -ItemType Directory -Path '" & pdfFolder & "' -Force"
        End If
        Exit Sub
    End If
    
    ' Apri la cartella
    shell.Exec "explorer.exe /select,""" & pdfFolder & """"
    
    ExitSub:
        Set shell = Nothing
        Exit Sub
    
    ErrHandler:
        MsgBox "Errore: " & Err.Number & " - " & Err.Description, vbExclamation, "Gestione PDF"
        GoTo ExitSub
End Sub

' ============================================================
' SUB: AggiungiBottoniToolbar
' Descrizione: Aggiunge pulsanti alla toolbar per accesso rapido
' Esecuzione: Esegui una sola volta
' ============================================================

Sub AggiungiBottoniToolbar()
    ' Nota: Questa è una procedura di utilità
    ' I bottoni devono essere aggiunti manualmente dalla UI di Excel
    ' oppure tramite Customize Ribbon
    
    MsgBox "Per aggiungere pulsanti di accesso rapido:" & vbCrLf & vbCrLf & _
           "1. Nella barra della formula, clicca su 'Personalizza accesso rapido'" & vbCrLf & _
           "2. Seleziona 'Altre comandi'" & vbCrLf & _
           "3. Aggiungi una macro:" & vbCrLf & _
           "   - ApriGestorePDF (per apertura bloccante)" & vbCrLf & _
           "   - ApriGestorePDF_Async (per apertura in background)" & vbCrLf & vbCrLf & _
           "Oppure:" & vbCrLf & _
           "- Crea un pulsante con Form Control e assegnagli la macro ApriGestorePDF", _
           vbInformation, "Aggiunta pulsanti"
End Sub

' ============================================================
' SUB: TestConessione
' Descrizione: Testa la connessione con il server PDF
' ============================================================

Sub TestConessione()
    Dim xmlHTTP As Object
    Dim url As String
    
    On Error GoTo ErrHandler
    
    Set xmlHTTP = CreateObject("MSXML2.XMLHTTP")
    url = "http://localhost:5500/api/pdf-list"
    
    xmlHTTP.Open "GET", url, False
    xmlHTTP.Send
    
    If xmlHTTP.Status = 200 Then
        MsgBox "✓ Connessione OK" & vbCrLf & vbCrLf & _
               "Il server PDF è attivo e funzionante.", _
               vbInformation, "Test Connessione"
    Else
        MsgBox "✗ Connessione fallita" & vbCrLf & vbCrLf & _
               "Il server non risponde." & vbCrLf & _
               "Assicurati di aver avviato Start_ScriptPDF1.ps1", _
               vbExclamation, "Test Connessione"
    End If
    
    ExitSub:
        Set xmlHTTP = Nothing
        Exit Sub
    
    ErrHandler:
        MsgBox "Errore di connessione:" & vbCrLf & Err.Description, vbExclamation, "Test Connessione"
        GoTo ExitSub
End Sub

' ============================================================
' NOTE DI UTILIZZO
' ============================================================

' Come usare questo modulo:
' 
' 1. CONFIGURAZIONE INIZIALE (esegui una volta):
'    Sub ConfiguraGestorePDF()
'
' 2. APERTURA GESTIONE PDF (bloccante):
'    Sub ApriGestorePDF()
'
' 3. APERTURA GESTIONE PDF (non bloccante):
'    Sub ApriGestorePDF_Async()
'
' 4. APRI CARTELLA PDF LOCALE:
'    Sub ApriCartellaScriptPDF()
'
' 5. TEST CONNESSIONE:
'    Sub TestConessione()
'
' Puoi creare pulsanti in Excel che eseguono queste macro.
' Seleziona il pulsante, proprietà, e assegna la macro.
