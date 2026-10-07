Attribute VB_Name = "Modulo27"
Sub Sincronizza_elenco()
    '
    ' Sincronizza elenco coreo da "statico" a "border�"
    '

    ' Rimuove eventuali filtri attivi
    ActiveSheet.AutoFilterMode = False

    ' Aggiorna tutti i collegamenti
    ActiveWorkbook.RefreshAll
    
    ' Copia i dati dall'elenco statico
    Sheets("Elenco Brani (statico)").Select
    Range("$C$2:$F$612").Copy
    
    ' Incolla i dati nel foglio "border�"
    Sheets("border�").Select
    Range("$C$12").PasteSpecial Paste:=xlPasteValues ' Incolla solo i valori
    
     ' Copia i dati dall'elenco statico
    Sheets("Elenco Brani (statico)").Select
    Range("$I$2:$O$612").Copy
    
    ' Incolla i dati nel foglio "border�"
    Sheets("border�").Select
    Range("$H$12").PasteSpecial Paste:=xlPasteValues ' Incolla solo i valori
        
    ' Copia i dati dall'elenco statico
    Sheets("Elenco Brani (statico)").Select
    Range("$G$2:$G$612").Copy

    ' Incolla i dati nel foglio "border�"
    Sheets("border�").Select
    Range("$O$12").PasteSpecial Paste:=xlPasteValues ' Incolla solo i valori

    ' Rimuove la selezione e ottimizza l'interfaccia
    Application.CutCopyMode = False
    
    ' Messaggio di conferma (opzionale)
    MsgBox "Elenco sincronizzato con successo!", vbInformation

    ' wsSorgente.Activate
    ' wsSorgente.Range("D7").Select
    Sheets("border�").Select
    Range("D7").Select

End Sub
