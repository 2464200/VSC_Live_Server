Attribute VB_Name = "Modulo67"
Attribute VB_Name = "Modulo67"
' REVISIONE CODICE TRAMITE SCRIPT DI CODICE

Option Explicit

Sub AuditVBA_Completo()

    Dim VBComp As Object
    Dim CodeMod As Object
    
    Dim ProcDict As Object
    Dim CallDict As Object
    Dim ModuleLines As Object
    
    Dim i As Long
    Dim ProcName As String
    Dim ProcKind As Long
    Dim StartLine As Long
    Dim ProcLines As Long
    Dim LineText As String
    
    Dim wsProc As Worksheet
    Dim wsCall As Worksheet
    Dim wsMod As Worksheet
    
    Dim rProc As Long
    Dim rCall As Long
    Dim rMod As Long
    
    Set ProcDict = CreateObject("Scripting.Dictionary")
    Set CallDict = CreateObject("Scripting.Dictionary")
    Set ModuleLines = CreateObject("Scripting.Dictionary")
    
    
'---------------------------------------------------
' SCANSIONE PROCEDURE
'---------------------------------------------------

    For Each VBComp In ThisWorkbook.VBProject.VBComponents
    
        Set CodeMod = VBComp.CodeModule
        
        ModuleLines(VBComp.name) = CodeMod.CountOfLines
        
        i = 1
        
        Do While i < CodeMod.CountOfLines
        
            ProcName = CodeMod.ProcOfLine(i, ProcKind)
            
            If ProcName <> "" Then
            
                StartLine = CodeMod.ProcStartLine(ProcName, ProcKind)
                ProcLines = CodeMod.ProcCountLines(ProcName, ProcKind)
                
                If Not ProcDict.Exists(ProcName) Then
                
                    ProcDict.Add ProcName, Array(VBComp.name, ProcLines)
                
                End If
                
                i = StartLine + ProcLines
                
            Else
            
                i = i + 1
                
            End If
            
        Loop
    
    Next
    
    
'---------------------------------------------------
' SCANSIONE CHIAMATE
'---------------------------------------------------

    For Each VBComp In ThisWorkbook.VBProject.VBComponents
    
        Set CodeMod = VBComp.CodeModule
        
        For i = 1 To CodeMod.CountOfLines
        
            LineText = CodeMod.lines(i, 1)
            
            Dim k
            
            For Each k In ProcDict.keys
            
                If InStr(1, LineText, k & "(", vbTextCompare) > 0 _
                Or InStr(1, LineText, "Call " & k, vbTextCompare) > 0 Then
                
                    CallDict(k) = CallDict(k) + 1
                    
                End If
            
            Next
            
        Next
    
    Next
    
    
'---------------------------------------------------
' CREAZIONE FOGLI REPORT
'---------------------------------------------------

    Application.DisplayAlerts = False
    
    On Error Resume Next
    Worksheets("AUDIT_PROCEDURE").Delete
    Worksheets("AUDIT_CALLGRAPH").Delete
    Worksheets("AUDIT_MODULI").Delete
    On Error GoTo 0
    
    Application.DisplayAlerts = True
    
    
    Set wsProc = Worksheets.Add
    wsProc.name = "AUDIT_PROCEDURE"
    
    Set wsCall = Worksheets.Add
    wsCall.name = "AUDIT_CALLGRAPH"
    
    Set wsMod = Worksheets.Add
    wsMod.name = "AUDIT_MODULI"
    
    
'---------------------------------------------------
' REPORT PROCEDURE
'---------------------------------------------------

    wsProc.cells(1, 1) = "Procedura"
    wsProc.cells(1, 2) = "Modulo"
    wsProc.cells(1, 3) = "Righe"
    wsProc.cells(1, 4) = "Chiamate"
    wsProc.cells(1, 5) = "Analisi"
    
    rProc = 2
    
    Dim p
    Dim ModuleName As String
    Dim LineCount As Long
    Dim CallCount As Long
    Dim Status As String
    
    
    For Each p In ProcDict.keys
    
        ModuleName = ProcDict(p)(0)
        LineCount = ProcDict(p)(1)
        
        If CallDict.Exists(p) Then
            CallCount = CallDict(p)
        Else
            CallCount = 0
        End If
        
        Status = ""
        
        If CallCount = 0 Then
            Status = "POSSIBILE CODICE ORFANO"
        End If
        
        If LineCount > 100 Then
            Status = Status & " | PROCEDURA MOLTO LUNGA"
        End If
        
        
        wsProc.cells(rProc, 1) = p
        wsProc.cells(rProc, 2) = ModuleName
        wsProc.cells(rProc, 3) = LineCount
        wsProc.cells(rProc, 4) = CallCount
        wsProc.cells(rProc, 5) = Status
        
        rProc = rProc + 1
    
    Next
    
    wsProc.Columns.AutoFit
    
    
'---------------------------------------------------
' CALL GRAPH
'---------------------------------------------------

    wsCall.cells(1, 1) = "Procedura"
    wsCall.cells(1, 2) = "Numero chiamate"
    
    rCall = 2
    
    For Each p In CallDict.keys
    
        wsCall.cells(rCall, 1) = p
        wsCall.cells(rCall, 2) = CallDict(p)
        
        rCall = rCall + 1
    
    Next
    
    wsCall.Columns.AutoFit
    
    
'---------------------------------------------------
' REPORT MODULI
'---------------------------------------------------

    wsMod.cells(1, 1) = "Modulo"
    wsMod.cells(1, 2) = "Numero Righe"
    wsMod.cells(1, 3) = "Analisi"
    
    rMod = 2
    
    Dim m
    
    For Each m In ModuleLines.keys
    
        wsMod.cells(rMod, 1) = m
        wsMod.cells(rMod, 2) = ModuleLines(m)
        
        If ModuleLines(m) > 500 Then
        
            wsMod.cells(rMod, 3) = "MODULO MOLTO GRANDE"
        
        End If
        
        rMod = rMod + 1
    
    Next
    
    wsMod.Columns.AutoFit
    
    
'---------------------------------------------------
' INDICE QUALITA'
'---------------------------------------------------

    Dim score As Long
    
    score = 100
    
    If ProcDict.Count > 100 Then score = score - 10
    
    wsProc.cells(2, 8) = "Indice qualit? progetto"
    wsProc.cells(2, 9) = score & " / 100"
    
    
    MsgBox "Audit VBA completo terminato", vbInformation

End Sub


