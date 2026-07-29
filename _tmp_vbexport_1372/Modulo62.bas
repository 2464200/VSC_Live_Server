Attribute VB_Name = "Modulo62"
Option Explicit

' ========================================================================================
' MODULO STANDARD (es. ModChromeControl)
' Gestisce:
'   - Apertura di una finestra "normale" di Chrome sul secondo monitor
'     già a tutto schermo (massimizzata)
'   - Chiusura della stessa finestra tramite il PID del processo.
' ========================================================================================

#If VBA7 Then
    ' Dichiarazioni API per Excel 64 bit
    Private Declare PtrSafe Function OpenProcess Lib "kernel32" ( _
        ByVal dwDesiredAccess As Long, _
        ByVal bInheritHandle As Long, _
        ByVal dwProcessId As Long) As LongPtr

    Private Declare PtrSafe Function TerminateProcess Lib "kernel32" ( _
        ByVal hProcess As LongPtr, _
        ByVal uExitCode As Long) As Long

    Private Declare PtrSafe Function CloseHandle Lib "kernel32" ( _
        ByVal hObject As LongPtr) As Long

    Private Declare PtrSafe Function GetSystemMetrics Lib "user32" ( _
        ByVal nIndex As Long) As Long
#Else
    ' Dichiarazioni API per Excel 32 bit
    Private Declare Function OpenProcess Lib "kernel32" ( _
        ByVal dwDesiredAccess As Long, _
        ByVal bInheritHandle As Long, _
        ByVal dwProcessId As Long) As Long

    Private Declare Function TerminateProcess Lib "kernel32" ( _
        ByVal hProcess As Long, _
        ByVal uExitCode As Long) As Long

    Private Declare Function CloseHandle Lib "kernel32" ( _
        ByVal hObject As Long) As Long

    Private Declare Function GetSystemMetrics Lib "user32" ( _
        ByVal nIndex As Long) As Long
#End If

' Costanti per la gestione del processo e dei monitor
Private Const PROCESS_TERMINATE As Long = &H1    ' Permesso per terminare un processo
Private Const SM_CXSCREEN As Long = 0           ' Larghezza dello schermo principale (in pixel)

' Variabile globale che memorizza il PID di Chrome aperto dalla macro
Public g_lChromePID As Long

' ========================================================================================
' Sub ApriPaginaInChromeSecondoMonitorFullScreen
' Apre Chrome in modalità "normale" su una NUOVA finestra, posizionata sul secondo monitor
' (assunto a destra del principale) e già a tutto schermo (massimizzata) con l'URL indicato.
' ========================================================================================
Public Sub ApriPaginaInChromeSecondoMonitorFullScreen(ByVal sUrl As String)
    On Error GoTo GestioneErrore
    
    Dim sChromeExePath As String
    Dim sChromeExePathQuoted As String
    Dim sCommand As String
    Dim lPID As Long
    Dim lLarghezzaMonitorPrincipale As Long
    Dim sWindowPositionArg As String
    Dim sWindowOptions As String
    
    ' ------------------------------------------------------
    ' 1) Individua il percorso di chrome.exe
    '    (prima versione 64 bit, poi 32 bit)
    ' ------------------------------------------------------
    sChromeExePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    
    If Dir$(sChromeExePath) = vbNullString Then
        sChromeExePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    End If
    
    ' Se non trova chrome.exe in nessuno dei due percorsi, genera errore
    If Dir$(sChromeExePath) = vbNullString Then
        Err.Raise vbObjectError + 1000, "ApriPaginaInChromeSecondoMonitorFullScreen", _
                  "Impossibile trovare chrome.exe. Verifica il percorso di installazione di Chrome."
    End If
    
    ' Aggiunge le virgolette al percorso per gestire spazi nel path
    sChromeExePathQuoted = """" & sChromeExePath & """"
    
    ' ------------------------------------------------------
    ' 2) Calcola la posizione per il secondo monitor
    '    (assumendo che il secondo monitor sia a destra del principale)
    ' ------------------------------------------------------
    lLarghezzaMonitorPrincipale = GetSystemMetrics(SM_CXSCREEN)  ' larghezza monitor 1
    
    ' Posiziona la nuova finestra all'inizio del secondo monitor (X = larghezza monitor 1, Y = 0)
    sWindowPositionArg = "--window-position=" & CStr(lLarghezzaMonitorPrincipale) & ",0"
    
    ' ------------------------------------------------------
    ' 3) Imposta le opzioni finestra:
    '    - --new-window       => nuova finestra, non nuova scheda
    '    - --start-maximized  => apre la finestra già massimizzata (tutto schermo)
    '    - sWindowPositionArg => la sposta sul secondo monitor
    ' ------------------------------------------------------
    'sWindowOptions = "--new-window --start-maximized " & sWindowPositionArg
    sWindowOptions = "--new-window --kiosk " & sWindowPositionArg
    
    ' Costruisce il comando finale per Shell
    sCommand = sChromeExePathQuoted & " " & sWindowOptions & " " & """" & sUrl & """"
    
    ' ------------------------------------------------------
    ' 4) Avvia Chrome e memorizza il PID del processo lanciato
    ' ------------------------------------------------------
    lPID = shell(sCommand, vbNormalFocus)
    
    If lPID > 0 Then
        g_lChromePID = lPID
    Else
        Err.Raise vbObjectError + 1001, "ApriPaginaInChromeSecondoMonitorFullScreen", _
                  "Impossibile avviare Chrome tramite Shell."
    End If
    
Uscita:
    Exit Sub
    
GestioneErrore:
    ' In caso di errore mostra un messaggio all'utente e non blocca Excel
    MsgBox "Si è verificato un errore durante l'apertura della pagina in Chrome (secondo monitor, full screen)." & vbCrLf & _
           "Dettagli: " & Err.Number & " - " & Err.Description, _
           vbExclamation, "Errore ApriPaginaInChromeSecondoMonitorFullScreen"
    Resume Uscita
End Sub

' ========================================================================================
' Sub ChiudiChromeApertoDaMacro
' Chiude il processo di Chrome aperto da ApriPaginaInChromeSecondoMonitorFullScreen
' utilizzando il PID memorizzato in g_lChromePID.
' ATTENZIONE: chiude l'intera finestra di Chrome (tutte le eventuali schede in essa aperte).
' ========================================================================================
Public Sub ChiudiChromeApertoDaMacro()
    On Error GoTo GestioneErrore
    
#If VBA7 Then
    Dim hProcess As LongPtr
#Else
    Dim hProcess As Long
#End If
    
    ' Se non esiste un PID memorizzato, esce senza fare nulla
    If g_lChromePID = 0 Then
        GoTo Uscita
    End If
    
    ' Apre un handle al processo di Chrome con permesso di terminazione
    hProcess = OpenProcess(PROCESS_TERMINATE, 0&, g_lChromePID)
    
    If hProcess <> 0 Then
        ' Termina il processo (chiude la finestra di Chrome aperta dalla macro)
        Call TerminateProcess(hProcess, 0&)
        ' Chiude l'handle del processo
        Call CloseHandle(hProcess)
    End If
    
    ' Azzera il PID dopo la chiusura
    g_lChromePID = 0
    
Uscita:
    Exit Sub
    
GestioneErrore:
    ' In caso di errore mostra un messaggio all'utente e non blocca Excel
    MsgBox "Si è verificato un errore durante la chiusura della finestra di Chrome." & vbCrLf & _
           "Dettagli: " & Err.Number & " - " & Err.Description, _
           vbExclamation, "Errore ChiudiChromeApertoDaMacro"
    Resume Uscita
End Sub

' ========================================================================================
' CODICE DEL USERFORM (es. PAGINA02)
' Sostituisce:
'   OpenInChrome_IsolatedApp "http://127.0.0.1:5500/servizio.html"
' con l'apertura di Chrome "normale" sul secondo monitor, a tutto schermo.
' ========================================================================================

' Pulsante che apre la pagina HTML in una finestra normale di Chrome,
' sul secondo monitor, già a tutto schermo (massimizzata)
Private Sub CommandButton249_Click()
    On Error GoTo GestioneErrore
    
    Dim sUrl As String
    
    ' URL della pagina da aprire (puoi modificare questo indirizzo)
    sUrl = "http://127.0.0.1:5500/servizio.html"
    
    ' Apre la pagina in Chrome sul secondo monitor, full screen
    Call ApriPaginaInChromeSecondoMonitorFullScreen(sUrl)
    
Uscita:
    Exit Sub
    
GestioneErrore:
    ' In caso di errore mostra un messaggio ma non blocca Excel
    MsgBox "Si è verificato un errore nel pulsante di apertura pagina (Chrome fullscreen)." & vbCrLf & _
           "Dettagli: " & Err.Number & " - " & Err.Description, _
           vbExclamation, "Errore CommandButton249_Click"
    Resume Uscita
End Sub

' Pulsante che chiude la finestra di Chrome aperta dalla macro
' (usa il PID memorizzato in g_lChromePID)
Private Sub CommandButton239_Click()
    On Error GoTo GestioneErrore
    
    ' Chiude la finestra di Chrome aperta dal pulsante CommandButton249_Click
    Call ChiudiChromeApertoDaMacro
    
Uscita:
    Exit Sub
    
GestioneErrore:
    ' In caso di errore mostra un messaggio ma non blocca Excel
    MsgBox "Si è verificato un errore nel pulsante di chiusura pagina (Chrome fullscreen)." & vbCrLf & _
           "Dettagli: " & Err.Number & " - " & Err.Description, _
           vbExclamation, "Errore CommandButton239_Click"
    Resume Uscita
End Sub

