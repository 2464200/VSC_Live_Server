Attribute VB_Name = "Modulo39"
Sub NextCoreo()

    Dim wb As Workbook
    Dim wsBordero As Worksheet
    Dim wsElenco As Worksheet
    Dim wsNext As Worksheet
    Dim valoreD7 As String, valoreD9 As String
    Dim rngRicerca As Range
    Dim cellaTrovata As Range
    Dim risultato As String
      
    ' Imposta i riferimenti ai fogli
    Set wb = ThisWorkbook
    Set wsBordero = wb.Sheets("borderò")
    Set wsElenco = wb.Sheets("Elenco Brani (statico)")
    Set wsNext = wb.Sheets("NextCoreo")
    
    ' Leggi i valori da D7 e D9
    valoreD7 = Trim(wsBordero.Range("D7").Value)
    valoreD9 = Trim(wsBordero.Range("D9").Value)
    
    risultato = "" ' inizializza
    
    ' **Precedenza a D7 se entrambe sono valorizzate**
    If valoreD7 <> "" Then
        ' Cerca in colonna D (coreografia)
        Set rngRicerca = wsElenco.Range("D2:D600")
        Set cellaTrovata = rngRicerca.Find(What:=valoreD7, LookIn:=xlValues, LookAt:=xlWhole, _
                                           SearchOrder:=xlByRows, SearchDirection:=xlNext)
        
    ElseIf valoreD9 <> "" Then
        ' Cerca in colonna C (ID)
        Set rngRicerca = wsElenco.Range("C2:C600")
        Set cellaTrovata = rngRicerca.Find(What:=valoreD9, LookIn:=xlValues, LookAt:=xlWhole, _
                                           SearchOrder:=xlByRows, SearchDirection:=xlNext)
    End If
    
    ' Se trovato, scrivi i valori corrispondenti nel foglio NextCoreo
    If Not cellaTrovata Is Nothing Then
        ' Scrivi in A1 l'ID (colonna C)
        wsNext.Range("A1").Value = wsElenco.cells(cellaTrovata.Row, "C").Value
        
        ' Scrivi in B1 la coreografia (colonna D)
        wsNext.Range("B1").Value = wsElenco.cells(cellaTrovata.Row, "D").Value
        
        ' Scrivi in C1 il livello (colonna H)
        wsNext.Range("C1").Value = wsElenco.cells(cellaTrovata.Row, "H").Value
        
        ' Scrivi in D1 lo script (colonna N)
        wsNext.Range("D1").Value = wsElenco.cells(cellaTrovata.Row, "N").Value
        
        ' Salva il risultato per feedback
        risultato = wsElenco.cells(cellaTrovata.Row, "D").Value
    Else
        ' Nessuna corrispondenza: svuota le celle
        wsNext.Range("A1").Value = ""
        wsNext.Range("B1").Value = ""
        wsNext.Range("C1").Value = ""
        wsNext.Range("D1").Value = ""
    End If
    
    ' Messaggio di conferma (silenzioso in cella A2 invece di popup)
    If risultato <> "" Then
        wsNext.Range("A2").Value = "Coreografia trovata: " & risultato
    Else
        wsNext.Range("A2").Value = "Nessuna corrispondenza trovata."
    End If

    ' Esporta il risultato in CSV
    Call EsportaNextCoreoCSV

End Sub


