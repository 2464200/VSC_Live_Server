Attribute VB_Name = "Modulo57"
Attribute VB_Name = "Modulo57"
Option Explicit

' ====================================================================================
'  modWebcamAPI
'  Modulo per la gestione dell?anteprima LIVE della webcam compatibile
'  sia con Excel a 32 bit che a 64 bit (Office/VBA7).
' ====================================================================================

' =========================================================================
' DICHIARAZIONI API COMPATIBILI 32/64 BIT
' =========================================================================
#If VBA7 Then
    ' === Versione per Office/VBA7 (32 e 64 bit) ===
    ' Crea la finestra di cattura video della webcam
    Private Declare PtrSafe Function capCreateCaptureWindow Lib "avicap32.dll" Alias "capCreateCaptureWindowA" _
        (ByVal caption As String, ByVal dwStyle As Long, ByVal X As Long, _
         ByVal Y As Long, ByVal nWidth As Long, ByVal nHeight As Long, _
         ByVal hWndParent As LongPtr, ByVal nID As Long) As LongPtr

    ' Invia messaggi alla finestra della webcam
    Private Declare PtrSafe Function SendMessage Lib "user32" Alias "SendMessageA" _
        (ByVal hWnd As LongPtr, ByVal Msg As Long, _
         ByVal wParam As LongPtr, ByVal lParam As LongPtr) As LongPtr

    ' Chiude una finestra Windows
    Private Declare PtrSafe Function DestroyWindow Lib "user32" _
        (ByVal hWnd As LongPtr) As Long

    ' Variabile globale: handle finestra di preview (puntatore 32/64 bit)
    Public hCapWnd As LongPtr

#Else
    ' === Versione per Office precedenti (VBA6 a 32 bit) ===
    ' Crea la finestra di cattura video della webcam
    Private Declare Function capCreateCaptureWindow Lib "avicap32.dll" Alias "capCreateCaptureWindowA" _
        (ByVal caption As String, ByVal dwStyle As Long, ByVal X As Long, _
         ByVal Y As Long, ByVal nWidth As Long, ByVal nHeight As Long, _
         ByVal hWndParent As Long, ByVal nID As Long) As Long

    ' Invia messaggi alla finestra della webcam
    Private Declare Function SendMessage Lib "user32" Alias "SendMessageA" _
        (ByVal hWnd As Long, ByVal Msg As Long, _
         ByVal wParam As Long, ByVal lParam As Long) As Long

    ' Chiude una finestra Windows
    Private Declare Function DestroyWindow Lib "user32" _
        (ByVal hWnd As Long) As Long

    ' Variabile globale: handle finestra di preview (32 bit)
    Public hCapWnd As Long
#End If

' === Costanti API ===
Public Const WM_CAP_DRIVER_CONNECT As Long = &H40A&
Public Const WM_CAP_DRIVER_DISCONNECT As Long = &H40B&
Public Const WM_CAP_SET_PREVIEW As Long = &H432&
Public Const WM_CAP_SET_PREVIEWRATE As Long = &H434&
Public Const WM_CAP_SET_SCALE As Long = &H435&

' === Variabili Globali ===
Public IsPreviewOn As Boolean   ' Stato dell?anteprima webcam


' ================================================================================
' AvviaPreview
' Avvia l?anteprima video della webcam all?interno di una finestra (handle del parent).
' hWndParent = handle della finestra contenitore (es. UserForm o finestra Excel)
' Larghezza, Altezza = dimensioni area di preview in pixel
' ================================================================================
Public Sub AvviaPreview( _
    ByVal hWndParent As LongPtr, _
    ByVal Larghezza As Long, _
    ByVal Altezza As Long)
    
    On Error GoTo GestioneErrore
    
    ' Crea la finestra di cattura video
    hCapWnd = capCreateCaptureWindow( _
                    "Anteprima Webcam", _
                    0, _
                    0, 0, _
                    Larghezza, Altezza, _
                    hWndParent, _
                    0)
    
    ' Se non ? stato creato alcun handle, esce senza fare altro
    If hCapWnd = 0 Then
        IsPreviewOn = False
        Exit Sub
    End If
    
    ' Connessione al driver della webcam (indice 0)
    Call SendMessage(hCapWnd, WM_CAP_DRIVER_CONNECT, 0, 0)
    
    ' Imposta scala, framerate e attiva la preview
    Call SendMessage(hCapWnd, WM_CAP_SET_SCALE, 1, 0)
    Call SendMessage(hCapWnd, WM_CAP_SET_PREVIEWRATE, 30, 0) ' 30 ms tra i frame
    Call SendMessage(hCapWnd, WM_CAP_SET_PREVIEW, 1, 0)
    
    IsPreviewOn = True
    Exit Sub

GestioneErrore:
    ' In caso di errore, chiude eventuale finestra aperta e resetta lo stato
    If hCapWnd <> 0 Then
        DestroyWindow hCapWnd
    End If
    hCapWnd = 0
    IsPreviewOn = False
End Sub


' ================================================================================
' FermaPreview
' Ferma l?anteprima dalla webcam e libera la finestra di cattura.
' ================================================================================
Public Sub FermaPreview()
    On Error GoTo GestioneErrore
    
    ' Se esiste una finestra di capture, disconnette il driver e la chiude
    If hCapWnd <> 0 Then
        Call SendMessage(hCapWnd, WM_CAP_DRIVER_DISCONNECT, 0, 0)
        DestroyWindow hCapWnd
    End If
    
    hCapWnd = 0
    IsPreviewOn = False
    Exit Sub

GestioneErrore:
    ' In caso di errore resetta comunque lo stato e l?handle
    hCapWnd = 0
    IsPreviewOn = False
End Sub


Public Function StartPreview(ParentHwnd As Long, W As Long, H As Long, CamIndex As Long) As Boolean
    On Error Resume Next

    If hCapWnd <> 0 Then StopPreview

    hCapWnd = capCreateCaptureWindow("PreviewWindow", 0, 0, 0, W, H, ParentHwnd, 0)

    If hCapWnd = 0 Then Exit Function

    If SendMessage(hCapWnd, WM_CAP_DRIVER_CONNECT, CamIndex, 0) = 0 Then
        DestroyWindow hCapWnd
        hCapWnd = 0
        Exit Function
    End If

    SendMessage hCapWnd, WM_CAP_SET_SCALE, True, 0
    SendMessage hCapWnd, WM_CAP_SET_PREVIEWRATE, 30, 0
    SendMessage hCapWnd, WM_CAP_SET_PREVIEW, True, 0

    IsPreviewOn = True
    StartPreview = True
End Function


Public Sub StopPreview()
    On Error Resume Next
    If hCapWnd <> 0 Then
        SendMessage hCapWnd, WM_CAP_DRIVER_DISCONNECT, 0, 0
        DestroyWindow hCapWnd
        hCapWnd = 0
    End If
    IsPreviewOn = False
End Sub


()
