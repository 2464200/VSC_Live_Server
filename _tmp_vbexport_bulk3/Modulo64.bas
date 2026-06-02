Attribute VB_Name = "Modulo64"
Attribute VB_Name = "Modulo64"
Option Explicit

Sub AvvioSistemaPDF()

    InizializzaPDF
    CaricaListaPDF
    
    If PDFCount > 0 Then
        ApriPDFByIndex 1
    End If

End Sub

' ======================================================
'  Modulo: modPDFViewer
'  Scopo: Gestire apertura, navigazione e chiusura dei PDF
'         tramite indice e ComboBox in Excel VBA.
' ======================================================

' === DICHIARAZIONI PUBBLICHE (PARAMETRI CONFIGURABILI) ===
Public PDF_FOLDER As String                ' Cartella in cui si trovano i PDF (es. "C:\PDF\")
Public PDFFileList() As String             ' Array con i nomi dei file PDF
Public PDFCount As Long                    ' Numero totale di PDF
Public CurrentPDFIndex As Long             ' Indice del PDF attualmente aperto (1-based)
Public AcrobatProcessID As Long            ' ID processo del lettore PDF aperto

' === API PER LA FUNZIONE SLEEP (PAUSA) ===
'#If VBA7 Then
    ' Per Office a 64 bit
 '   Public Declare PtrSafe Sub Sleep Lib "kernel32" (ByVal dwMilliseconds As LongPtr)
'#Else
 '   ' Per Office a 32 bit
 '   Public Declare Sub Sleep Lib "kernel32" (ByVal dwMilliseconds As Long)
'#End If

' ======================================================
'  PROCEDURA: ApriPDFByIndex
'  Scopo: Aprire il PDF corrispondente all'indice passato,
'         spostare la finestra sul secondo monitor e
'         aggiornare l'indice corrente.
' ======================================================
Public Sub ApriPDFByIndex(ByVal idx As Long)
    On Error GoTo GestioneErrore
    
    Dim fullPath As String
    
    ' Controllo validit? indice
    If idx < 1 Or idx > PDFCount Then Exit Sub
    
    ' Costruzione percorso completo del file
    fullPath = PDF_FOLDER & PDFFileList(idx)
    
    ' Controllo esistenza file
    If Dir$(fullPath) = "" Then
        MsgBox "File non trovato:" & vbCrLf & fullPath, vbCritical + vbOKOnly, "Errore apertura PDF"
        Exit Sub
    End If
    
    ' (Opzionale) Chiudi eventuale Acrobat aperto prima di aprirne un altro
    'ChiudiAcrobat
    
    ' Apertura del PDF con il lettore predefinito (Shell con percorso completo tra virgolette)
    AcrobatProcessID = shell("""" & fullPath & """", vbNormalFocus)
    
    ' Breve pausa per permettere al lettore PDF di avviarsi
    Sleep 800
    
    ' Sposta Acrobat sul monitor secondario (funzione da implementare altrove)
    SpostaAcrobatSuSecondoMonitor
    
    ' Aggiorna l'indice corrente
    CurrentPDFIndex = idx

Uscita:
    Exit Sub

GestioneErrore:
    ' In caso di errore, mostra un messaggio non bloccante e termina in modo pulito
    MsgBox "Si ? verificato un errore nell'apertura del PDF." & vbCrLf & _
           "Descrizione: " & Err.Description, _
           vbExclamation + vbOKOnly, "Errore ApriPDFByIndex"
    Resume Uscita
End Sub


' ======================================================
'  PROCEDURA: ChiudiAcrobat
'  Scopo: Chiudere forzatamente i processi di Acrobat Reader
'         o Acrobat se presenti.
' ======================================================
Public Sub ChiudiAcrobat()
    On Error GoTo GestioneErrore
    
    ' Chiude Acrobat Reader (AcroRd32.exe) se in esecuzione
    shell "cmd /c taskkill /IM AcroRd32.exe /F", vbHide
    
    ' Chiude Acrobat completo (Acrobat.exe) se in esecuzione
    shell "cmd /c taskkill /IM Acrobat.exe /F", vbHide

Uscita:
    Exit Sub

GestioneErrore:
    ' In caso di errore nella chiusura, non bloccare l'esecuzione
    ' (es. se il processo non esiste) ma informare l'utente solo se necessario
    'MsgBox "Si ? verificato un errore nella chiusura di Acrobat." & vbCrLf & _
    '       "Descrizione: " & Err.Description, _
    '       vbExclamation + vbOKOnly, "Errore ChiudiAcrobat"
    Resume Uscita
End Sub

' ======================================================
'  NOTA: Da implementare in un altro modulo o qui:
'  Public Sub SpostaAcrobatSuSecondoMonitor()
'       ' Codice per spostare la finestra di Acrobat sul secondo monitor
'  End Sub
' ======================================================



' ======================================================
'  PROCEDURA: InizializzaPDF
'  Scopo: Impostare la cartella dei PDF (da chiamare all'avvio)
' ======================================================
Public Sub InizializzaPDF()
    
    PDF_FOLDER = "c:\vsc_script_pdf\"
    
    ' Verifica esistenza cartella
    If Dir(PDF_FOLDER, vbDirectory) = "" Then
        MsgBox "La cartella PDF non esiste:" & vbCrLf & PDF_FOLDER, _
               vbCritical + vbOKOnly, "Errore inizializzazione PDF"
        Exit Sub
    End If
    
End Sub



