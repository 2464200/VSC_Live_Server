VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} PAGINA07 
   Caption         =   "frmPAGINA07"
   ClientHeight    =   12420
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   16770
   OleObjectBlob   =   "PAGINA07.frx":0000
   StartUpPosition =   1  'CenterOwner
End
Attribute VB_Name = "PAGINA07"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

Dim RecTimer As Date
Dim IsRecording As Boolean
Dim FlashState As Boolean

Private Sub CommandButton31_Click()
    Unload Me
    INDICE.Show
End Sub

Private Sub CommandButton32_Click()
    Unload Me
End Sub

Private Sub UserForm_Initialize()

    ' === RISOLUZIONI ===
    ComboBoxResol.Clear
    ComboBoxResol.AddItem "640x480"
    ComboBoxResol.AddItem "800x600"
    ComboBoxResol.AddItem "1280x720"
    ComboBoxResol.AddItem "1920x1080"
    ComboBoxResol.ListIndex = 0
    
    ' === FPS ===
    ComboFPS.Clear
    ComboFPS.AddItem "15"
    ComboFPS.AddItem "25"
    ComboFPS.AddItem "30"
    ComboFPS.ListIndex = 2
    
    ' === BITRATE ===
    TextBitrate.text = "2500"

    ' === CARICA ELENCO WEBCAM ===
    Dim cams As Collection, C As Variant
    Set cams = GetWebcamList()

    ComboBoxWebcam.Clear
    For Each C In cams
        ComboBoxWebcam.AddItem C
    Next

    If ComboBoxWebcam.ListCount > 0 Then ComboBoxWebcam.ListIndex = 0

    CameraName = ComboBoxWebcam.text
    LabelNomeCam.caption = CameraName
    
    ' === AVVIO ANTEPRIMA LIVE ===
    Call StartPreview(picPreview.hWnd, picPreview.width, picPreview.height, ComboBoxWebcam.ListIndex)

    LabelStato.caption = "Pronto"
    LabelREC.caption = ""
    LabelTimer.caption = "00:00:00"

End Sub



Private Sub ComboBoxWebcam_Change()
    CameraName = ComboBoxWebcam.text
    LabelNomeCam.caption = CameraName

    StopPreview
    Call StartPreview(picPreview.hWnd, picPreview.width, picPreview.height, ComboBoxWebcam.ListIndex)
End Sub



' ====================
' AVVIO REGISTRAZIONE
' ====================

Private Sub CommandButton1001_Click()

    If IsRecording Then Exit Sub

    BitrateKbps = CLng(TextBitrate.text)
    FPS = CLng(ComboFPS.text)
    ResolutionText = ComboBoxResol.text

    Call StopPreview
    Call StartRecording1000

    IsRecording = True
    RecTimer = Now
    
    LabelStato.caption = "REC"
    LabelREC.caption = "? REC"
    LabelREC.ForeColor = RGB(255, 0, 0)

    ' timer & flash avviati dal modulo
    Call TimerLoop
    Call FlashRec

End Sub



' ====================
' STOP REC
' ====================
Private Sub CommandButton1002_Click()

    If Not IsRecording Then Exit Sub

    Call StopRecording1000
    IsRecording = False

    LabelStato.caption = "Pronto"
    LabelREC.caption = ""

    ' riattiva anteprima
    Call StartPreview(picPreview.hWnd, picPreview.width, picPreview.height, ComboBoxWebcam.ListIndex)

End Sub



' ====================
' APRI ULTIMO VIDEO
' ====================
Private Sub CommandButton1003_Click()

    Dim fso As Object: Set fso = CreateObject("Scripting.FileSystemObject")
    Dim folder As String: folder = EnsureTrailingBackslash(SAVE_FOLDER)

    Dim newest As Object, ff As Object
    Dim d As Date: d = #1/1/1900#

    For Each ff In fso.GetFolder(folder).files
        If LCase(fso.GetExtensionName(ff.name)) = "mp4" Then
            If ff.DateLastModified > d Then
                d = ff.DateLastModified
                Set newest = ff
            End If
        End If
    Next

    If Not newest Is Nothing Then
        shell """" & VLC_PATH & """ """ & newest.path & """", vbNormalFocus
    Else
        MsgBox "Nessun video trovato.", vbExclamation
    End If

End Sub



' ====================
' TIMER DISPLAY
' ====================
Sub StartTimerLoop()
    If IsRecording Then
        LabelTimer.caption = Format(Now - RecTimer, "hh:mm:ss")
        Application.OnTime Now + TimeValue("0:00:01"), "PAGINA07.StartTimerLoop"
    End If
End Sub


' ====================
' INDICATORE LAMPEGGIANTE
' ====================
'Sub StartFlashREC()
    'If IsRecording Then
        'FlashState = Not FlashState
        'LabelREC.Visible = FlashState
        'Application.OnTime Now + TimeValue("0:00:00.5"), "PAGINA07.StartFlashREC"
    'End If
'End Sub

