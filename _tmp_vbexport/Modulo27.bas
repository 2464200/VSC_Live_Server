Attribute VB_Name = "Modulo27"
Sub Sincronizza_elenco()
    '
    ' Sincronizza elenco coreo da "statico" a "borderò"
    '
    
    ' Rimuove eventuali filtri attivi
    ActiveSheet.AutoFilterMode = False
    
    ' Aggiorna tutti i collegamenti
    ActiveWorkbook.RefreshAll
    
    ' Copia i dati dall'elenco statico
    Sheets("Elenco Brani (statico)").Select
    Range("$C$2:$F$602").Copy
    
    ' Incolla i dati nel foglio "borderò"
    Sheets("borderò").Select
    Range("$C$12").PasteSpecial Paste:=xlPasteValues ' Incolla solo i valori
    
     ' Copia i dati dall'elenco statico
    Sheets("Elenco Brani (statico)").Select
    Range("$H$2:$N$602").Copy
    
    ' Incolla i dati nel foglio "borderò"
    Sheets("borderò").Select
    Range("$H$12").PasteSpecial Paste:=xlPasteValues ' Incolla solo i valori
        
    ' Rimuove la selezione e ottimizza l'interfaccia
    Application.CutCopyMode = False
    
    ' Messaggio di conferma (opzionale)
    MsgBox "Elenco sincronizzato con successo!", vbInformation
End Sub
