Attribute VB_Name = "Modulo27"
Sub Sincronizza_elenco()
    '
    ' Sincronizza elenco coreo da "statico" a "border�"
    '
    Dim wsStatic As Worksheet
    Dim lastRowStatic As Long
    Dim lastRowStaticC As Long
    Dim lastRowStaticH As Long
    
    ' Rimuove eventuali filtri attivi
    ActiveSheet.AutoFilterMode = False
    
    ' Aggiorna tutti i collegamenti
    ActiveWorkbook.RefreshAll
    
    ' Determina l'ultimo record valido nell'elenco statico
    Set wsStatic = Sheets("Elenco Brani (statico)")
    lastRowStaticC = wsStatic.Cells(wsStatic.Rows.Count, "C").End(xlUp).Row
    lastRowStaticH = wsStatic.Cells(wsStatic.Rows.Count, "H").End(xlUp).Row
    If lastRowStaticC > lastRowStaticH Then
        lastRowStatic = lastRowStaticC
    Else
        lastRowStatic = lastRowStaticH
    End If
    If lastRowStatic < 2 Then lastRowStatic = 2
    
    ' Copia i dati dall'elenco statico
    wsStatic.Range("$C$2:$F$" & lastRowStatic).Copy
    
    ' Incolla i dati nel foglio "border�"
    Sheets("border�").Select
    Range("$C$12").PasteSpecial Paste:=xlPasteValues ' Incolla solo i valori
    
     ' Copia i dati dall'elenco statico
    wsStatic.Range("$H$2:$N$" & lastRowStatic).Copy
    
    ' Incolla i dati nel foglio "border�"
    Sheets("border�").Select
    Range("$H$12").PasteSpecial Paste:=xlPasteValues ' Incolla solo i valori
        
    ' Rimuove la selezione e ottimizza l'interfaccia
    Application.CutCopyMode = False
    
    ' Messaggio di conferma (opzionale)
    MsgBox "Elenco sincronizzato con successo!", vbInformation
End Sub
