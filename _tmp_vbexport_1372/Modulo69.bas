Attribute VB_Name = "Modulo69"
Option Explicit

' ============================================================
' DASH LOOP – Controllo AutoHotkey UX + TIMER UI Excel
'
' ? QUESTO CODICE VA INCOLLATO INTERAMENTE
'    IN UN **MODULO STANDARD** (es. Modulo69)
'
' ? I pulsanti dello UserForm PAGINA10 useranno:
'    - Start Dash  -> AvviaDashLoop
'    - Stop Dash   -> FermaDashLoop
'    - Start UI    -> StartTextBoxTimer
'    - Stop UI     -> StopTextBoxTimer
' ============================================================


' =========================
' === VARIABILI GLOBALI ===
' =========================

' --- Timer TextBox ---
Public NextUpdate As Date
Public TextBoxTimerAttivo As Boolean

' --- Timer Dash Loop ---
Private g_NextRun As Date
Private g_TimerDashAttivo As Boolean


' =========================
' === COSTANTI SISTEMA ===
' =========================

Private Const AHK_EXE_PATH As String = "C:\Program Files\AutoHotkey\UX\AutoHotkeyUX.exe"
Private Const AHK_SCRIPT_PATH As String = "C:\VSC_Live_Server\DASH\dash_loop_C.ahk"

Private Const SHEET_STATUS As String = "NextCoreo"
Private Const CELL_STATUS As String = "A30"

Private Const SHEET_INDICATOR As String = "PAGINA10"
Private Const CELL_INDICATOR As String = "B2"

Private Const DASH_TIMER_SECONDS As Double = 10
Private Const UI_TIMER_SECONDS As Double = 3


' ============================================================
' === AVVIO / STOP DASH LOOP AUTOHOTKEY ======================
' ============================================================

Public Sub AvviaDashLoop()
    On Error GoTo GestioneErrore

    If IsAutoHotkeyRunning() Then
        AggiornaStatoDash
        Exit Sub
    End If

    If Dir(AHK_EXE_PATH, vbNormal) = "" Then
        MsgBox "AutoHotkey UX non trovato:" & vbCrLf & AHK_EXE_PATH, vbCritical
        Exit Sub
    End If

    If Dir(AHK_SCRIPT_PATH, vbNormal) = "" Then
        MsgBox "Script AutoHotkey non trovato:" & vbCrLf & AHK_SCRIPT_PATH, vbCritical
        Exit Sub
    End If

    shell """" & AHK_EXE_PATH & """ """ & AHK_SCRIPT_PATH & """", vbHide

    AvviaTimerDash
    AggiornaStatoDash
    Exit Sub

GestioneErrore:
    MsgBox "Errore AvviaDashLoop:" & vbCrLf & Err.Description, vbCritical
End Sub


Public Sub FermaDashLoop()
    On Error Resume Next

    If IsAutoHotkeyRunning() Then
        shell "taskkill /F /IM AutoHotkeyUX.exe /T", vbHide
    End If

    FermaTimerDash
    AggiornaStatoDash
End Sub


' ============================================================
' === TIMER DASH LOOP ========================================
' ============================================================

Private Sub AvviaTimerDash()
    g_TimerDashAttivo = True
    PianificaDash
End Sub

Private Sub FermaTimerDash()
    g_TimerDashAttivo = False
    Application.OnTime g_NextRun, "TimerAggiornaStatoDash", , False
End Sub

Public Sub TimerAggiornaStatoDash()
    If Not g_TimerDashAttivo Then Exit Sub
    AggiornaStatoDash
    PianificaDash
End Sub

Private Sub PianificaDash()
    g_NextRun = Now + TimeSerial(0, 0, DASH_TIMER_SECONDS)
    Application.OnTime g_NextRun, "TimerAggiornaStatoDash"
End Sub


' ============================================================
' === AGGIORNAMENTO STATO DASH ===============================
' ============================================================

Public Sub AggiornaStatoDash()
    On Error Resume Next

    Dim wsStatus As Worksheet
    Dim wsIndicator As Worksheet

    Set wsStatus = ThisWorkbook.Worksheets(SHEET_STATUS)
    Set wsIndicator = ThisWorkbook.Worksheets(SHEET_INDICATOR)

    If IsAutoHotkeyRunning() Then
        wsStatus.Range(CELL_STATUS).Value = "RUNNING"
        wsStatus.Range(CELL_STATUS).Font.Color = vbGreen
        wsIndicator.Range(CELL_INDICATOR).Value = "?"
        wsIndicator.Range(CELL_INDICATOR).Font.Color = vbGreen
    Else
        wsStatus.Range(CELL_STATUS).Value = "STOPPED"
        wsStatus.Range(CELL_STATUS).Font.Color = vbRed
        wsIndicator.Range(CELL_INDICATOR).Value = "?"
        wsIndicator.Range(CELL_INDICATOR).Font.Color = vbRed
    End If
End Sub


' ============================================================
' === START / STOP TIMER TEXTBOX (USERFORM) ==================
' ============================================================

Public Sub StartTextBoxTimer()
    If TextBoxTimerAttivo Then Exit Sub
    TextBoxTimerAttivo = True
    AggiornaTextBox4
End Sub

Public Sub StopTextBoxTimer()
    On Error Resume Next
    TextBoxTimerAttivo = False
    Application.OnTime NextUpdate, "AggiornaTextBox4", False
End Sub


Public Sub AggiornaTextBox4()
    On Error GoTo GestioneErrore

    If Not TextBoxTimerAttivo Then Exit Sub
    If Not IsUserFormLoaded("PAGINA10") Then Exit Sub

    PAGINA10.TextBox4.Value = _
        ThisWorkbook.Worksheets(SHEET_STATUS).Range(CELL_STATUS).Value

    NextUpdate = Now + TimeSerial(0, 0, UI_TIMER_SECONDS)
    Application.OnTime NextUpdate, "AggiornaTextBox4"
    Exit Sub

GestioneErrore:
    TextBoxTimerAttivo = False
End Sub


' ============================================================
' === UTILITY ================================================
' ============================================================

Private Function IsAutoHotkeyRunning() As Boolean
    Dim objWMI As Object, colProc As Object
    Set objWMI = GetObject("winmgmts:\\.\root\cimv2")
    Set colProc = objWMI.ExecQuery( _
        "SELECT * FROM Win32_Process WHERE Name='AutoHotkeyUX.exe'")
    IsAutoHotkeyRunning = (colProc.Count > 0)
End Function


Public Function IsUserFormLoaded(NomeForm As String) As Boolean
    Dim frm As Object
    For Each frm In VBA.UserForms
        If frm.name = NomeForm Then
            IsUserFormLoaded = True
            Exit Function
        End If
    Next frm
    IsUserFormLoaded = False
End Function

