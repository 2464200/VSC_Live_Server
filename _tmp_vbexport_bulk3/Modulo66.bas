Attribute VB_Name = "Modulo66"
Attribute VB_Name = "Modulo66"
'======================================================================
' MODULO VBA PER PULSANTI ACTIVEX IN EXCEL
' Apre le pagine HTML del progetto tramite clic su pulsanti
'
' ISTRUZIONI:
' 1. Apri il file Excel
' 2. Premi ALT+F11 per aprire l'Editor VBA
' 3. Inserisci un nuovo modulo: Progetto ? Modulo
' 4. Copia e incolla tutto il codice sotto
' 5. Crea i pulsanti ActiveX e assegna ogni subroutine al clic
'
'======================================================================

' CONFIGURAZIONE GLOBALE
Private Const BASE_URL As String = "http://localhost:5500"

'======================================================================
' PAGINE PRINCIPALI
'======================================================================

' Apri Home (index.html)
Public Sub Btn_Home_Click()
    ApriBrowser BASE_URL & "/index.html"
End Sub

' Apri Variante 1 (index1.html)
Public Sub Btn_Index1_Click()
    ApriBrowser BASE_URL & "/index1.html"
End Sub

' Apri Variante 2 (index2.html)
Public Sub Btn_Index2_Click()
    ApriBrowser BASE_URL & "/index2.html"
End Sub

'======================================================================
' SERVIZI E COREO
'======================================================================

' Apri Servizio 2 (Monitor Secondario)
Public Sub Btn_Servizio2_Click()
    ApriBrowser BASE_URL & "/servizio.html"
End Sub

' Apri Gestione PDF (ScriptPDF1)
Public Sub Btn_ScriptPDF1_Click()
    ApriBrowser1 BASE_URL & "/Prova/ScriptPDF1.html"
End Sub

'======================================================================
' REPORT
'======================================================================

' Apri Report Black Theme
Public Sub Btn_ReportBlack_Click()
    ApriBrowser BASE_URL & "/Prova/Report_black.html"
End Sub

' Apri Report White Theme
Public Sub Btn_ReportWhite_Click()
    ApriBrowser BASE_URL & "/Prova/Report_white.html"
End Sub

'======================================================================
' UTILIT? E DIAGNOSTICA
'======================================================================

' Apri Diagnostica
Public Sub Btn_Diagnostica_Click()
    ApriBrowser BASE_URL & "/diagnostica.html"
End Sub

' Apri NextCoreo 1 (se necessario)
Public Sub Btn_NextCoreo1_Click()
    ApriBrowser BASE_URL & "/NextCoreo1.html"
End Sub

' Apri NextCoreo 2 (se necessario)
Public Sub Btn_NextCoreo2_Click()
    ApriBrowser BASE_URL & "/NextCoreo2.html"
End Sub

'======================================================================
' FUNZIONE HELPER - APRI URL NEL BROWSER PREDEFINITO
' VERSIONE ROBUSTA
'======================================================================

Private Sub ApriBrowser(ByVal URL As String)
    
    On Error GoTo ErrorHandler
    
    If Trim(URL) = "" Then
        Err.Raise vbObjectError + 1000, , "URL non valido o vuoto."
    End If
    
    ThisWorkbook.FollowHyperlink Address:=URL, NewWindow:=True
    
    Exit Sub

ErrorHandler:
    MsgBox "Errore apertura browser: " & Err.Description, _
           vbCritical, "Errore"
End Sub

'======================================================================
' FUNZIONE BONUS - APRI DIRETTAMENTE IN una SCHEDA (Chrome)
'======================================================================

' Versione alternativa: apre sempre in Chrome (pi? affidabile)
Public Sub ApriBrowserChrome(URL As String)
    Dim shell As Object
    Dim chromePath As String
    
    On Error GoTo ErrorHandler
    
    ' Cerca Chrome nelle locazioni standard
    chromePath = SearchChrome()
    
    If chromePath = "" Then
        MsgBox "? Chrome non trovato nel sistema", vbCritical, "Errore"
        Exit Sub
    End If
    
    Set shell = CreateObject("WScript.Shell")
    shell.Run """" & chromePath & """ """ & URL & """", 1, False
    
    Set shell = Nothing
    Exit Sub
    
ErrorHandler:
    MsgBox "? Errore apertura Chrome: " & Err.Description, vbCritical, "Errore"
End Sub

'======================================================================
' FUNZIONE HELPER - CERCA CHROME NEL SISTEMA
'======================================================================

Private Function SearchChrome() As String
    Dim shell As Object
    Dim folderPaths As Variant
    Dim chromePath As String
    Dim i As Integer
    
    folderPaths = Array( _
        "C:\Program Files\Google\Chrome\Application\chrome.exe", _
        "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe", _
        "C:\Users\" & Environ("USERNAME") & "\AppData\Local\Google\Chrome\Application\chrome.exe" _
    )
    
    Set shell = CreateObject("WScript.Shell")
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    
    For i = LBound(folderPaths) To UBound(folderPaths)
        If fso.FileExists(folderPaths(i)) Then
            SearchChrome = folderPaths(i)
            Set fso = Nothing
            Exit Function
        End If
    Next i
    
    Set fso = Nothing
    SearchChrome = ""
End Function

'======================================================================
' FUNZIONE BONUS - APRI LINK IN SCHEDA NUOVA
'======================================================================

Public Sub ApriBrowserNuovaScheda(URL As String)
    Dim shell As Object
    Dim result As Variant
    
    On Error GoTo ErrorHandler
    
    Set shell = CreateObject("WScript.Shell")
    ' Apre in una nuova scheda del browser predefinito
    result = shell.Run "cmd /c start " & URL, 0, False
    
    Set shell = Nothing
    Exit Sub
    
ErrorHandler:
    MsgBox "? Errore: " & Err.Description, vbCritical, "Errore"
End Sub

'======================================================================
' FINE MODULO
'======================================================================











'======================================================================
' FUNZIONE PROVA - APRI LINK ...
'======================================================================

' Apri Gestione PDF (ScriptPDF1)
Public Sub Btn_Prova_click()
    ApriBrowser BASE_URL & "/Prova/ScriptPDF1.html"
End Sub



