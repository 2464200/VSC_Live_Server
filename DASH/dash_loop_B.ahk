#Requires AutoHotkey v2.0
Persistent

; =========================
; DASH LOOP (Enhanced + Startup Mask)
; Single-Edge navigation, fullscreen images, 4 slot con persistenza INI.
; =========================

; ===== CONFIGURAZIONE BASE =====
EDGE_PATHS := [
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
]
EDGE_ARGS := "--kiosk --inprivate --no-first-run --disable-features=TranslateUI --disable-session-crashed-bubble --overscroll-history-navigation=0"

; Durate di default per i 4 slot (ms)
SlotDurations := [10000, 10000, 10000, 10000]

; Config INI persistente
CONFIG_PATH := A_ScriptDir "\dashloop.ini"

; ===== STATO GLOBALE =====
isRunning := false
edgePID := 0
edgeHwnd := 0
imageGui := 0

BaseDir := A_ScriptDir
Slots := ["", "", "", ""]

StartupGui := 0
SlotEdits := []
BaseDirEdit := 0

; ===== HOTKEYS =====
^!s:: {
    global isRunning, Slots
    if !isRunning {
        if (Slots[1] = "" && Slots[2] = "" && Slots[3] = "" && Slots[4] = "") {
            LoadConfigIntoState()
        }
        isRunning := true
        MainLoop()
    }
}

^!x:: {
    StopAll()
}

; ===== AVVIO =====
BuildStartupGui()
StartupGui.Show()
Notify("DASH LOOP pronto. Maschera configurazione aperta.")

; ===== MAIN LOOP =====
MainLoop() {
    global isRunning, Slots, SlotDurations

    if !EnsureEdge() {
        Notify("Edge non trovato o non avviabile.")
        isRunning := false
        return
    }

    while isRunning {
        for idx, res in Slots {
            if !isRunning {
                break
            }
            ShowResource(res, SlotDurations[idx])
        }
    }

    CloseImage()
    CloseEdge()
}

; ===== MOSTRA RISORSA =====
ShowResource(resource, duration) {
    global isRunning

    if !isRunning {
        return
    }

    if (resource = "") {
        HoldWithCancel(duration)
        return
    }

    if IsImageFile(resource) {
        if !IsUrl(resource) && !FileExist(resource) {
            Notify("Immagine non trovata: " resource)
            HoldWithCancel(1000)
            return
        }
        ShowImageFullscreen(resource, duration)
        return
    }

    if IsUrl(resource) {
        host := ExtractHost(resource)
        if host && !Ping(host) {
            HoldWithCancel(duration)
            return
        }
        NavigateAndHold(resource, duration)
        return
    }

    if !FileExist(resource) {
        Notify("File non trovato: " resource)
        HoldWithCancel(1000)
        return
    }

    NavigateAndHold(resource, duration)
}

; ===== EDGE MANAGEMENT =====
EnsureEdge() {
    global edgePID, edgeHwnd, EDGE_ARGS

    if (edgePID && ProcessExist(edgePID)) {
        hwnd := WinExist("ahk_pid " edgePID)
        if hwnd {
            edgeHwnd := hwnd
            return true
        }
    }

    edgeExe := DetectEdgePath()
    if !edgeExe {
        return false
    }

    cmd := '"' edgeExe '" ' EDGE_ARGS ' "about:blank"'
    try {
        edgePID := Run(cmd, , "Hide")
    } catch as err {
        Notify("Errore avvio Edge: " err.Message)
        edgePID := 0
        return false
    }

    if WinWaitPID(edgePID, 8000) {
        edgeHwnd := WinExist("ahk_pid " edgePID)
        return true
    }

    return false
}

DetectEdgePath() {
    global EDGE_PATHS
    for p in EDGE_PATHS {
        if FileExist(p) {
            return p
        }
    }
    return ""
}

CloseEdge() {
    global edgePID, edgeHwnd

    if (edgePID <= 0) {
        return
    }

    try ProcessClose(edgePID)
    Sleep(200)

    if ProcessExist(edgePID) {
        try Run("taskkill /F /PID " edgePID " /T", , "Hide")
    }

    edgePID := 0
    edgeHwnd := 0
}

; ===== NAVIGAZIONE =====
NavigateAndHold(pathOrUrl, duration) {
    global isRunning, edgePID, edgeHwnd

    if !isRunning {
        return
    }

    if !(edgePID && ProcessExist(edgePID)) {
        if !EnsureEdge() {
            return
        }
    }

    displayPath := pathOrUrl
    if !IsUrl(pathOrUrl) {
        displayPath := "file:///" . StrReplace(pathOrUrl, "\", "/")
    }

    if edgeHwnd {
        WinActivate("ahk_id " edgeHwnd)
    }

    Send("^l")
    Sleep(100)
    A_Clipboard := displayPath
    ClipWait(1)
    Send("^v{Enter}")

    HoldWithCancel(500)
    HoldWithCancel(duration)
}

; ===== IMMAGINI FULLSCREEN =====
ShowImageFullscreen(imagePath, duration) {
    global imageGui

    if !FileExist(imagePath) {
        Notify("Immagine non trovata: " imagePath)
        HoldWithCancel(1000)
        return
    }

    CloseImage()

    imageGui := Gui("+AlwaysOnTop -Caption +ToolWindow")
    imageGui.BackColor := "000000"

    sw := A_ScreenWidth
    sh := A_ScreenHeight

    try {
        iw := 0
        ih := 0
        ImageGetSize(imagePath, &iw, &ih)
        if (iw > 0 && ih > 0) {
            scale := Min(sw / iw, sh / ih)
            tw := Round(iw * scale)
            th := Round(ih * scale)
            x := Round((sw - tw) / 2)
            y := Round((sh - th) / 2)
            imageGui.AddPicture("x" x " y" y " w" tw " h" th " +BackgroundTrans", imagePath)
        } else {
            imageGui.AddPicture("x0 y0 w" sw " h" sh " +BackgroundTrans", imagePath)
        }
    } catch {
        imageGui.AddPicture("x0 y0 w" sw " h" sh " +BackgroundTrans", imagePath)
    }

    imageGui.Show("x0 y0 w" sw " h" sh)
    HoldWithCancel(duration)
    CloseImage()
}

CloseImage() {
    global imageGui
    try {
        if IsObject(imageGui) {
            imageGui.Destroy()
        }
    }
    imageGui := 0
}

; ===== GUI INIZIALE =====
BuildStartupGui() {
    global StartupGui, BaseDirEdit, SlotEdits, Slots, BaseDir

    LoadConfigIntoState()

    StartupGui := Gui("+AlwaysOnTop +Caption +ToolWindow", "DASH LOOP - Configurazione iniziale")
    StartupGui.MarginX := 16
    StartupGui.MarginY := 12

    StartupGui.AddText(, "Directory base (dove sono salvati i file):")
    BaseDirEdit := StartupGui.AddEdit("w500", BaseDir)
    browseBase := StartupGui.AddButton("x+m", "Sfoglia...")
    browseBase.OnEvent("Click", HandleBrowseBase)

    StartupGui.AddText("y+10", "Slot (file locale o URL). I 4 slot sono identici e verranno ripetuti in loop:")

    SlotEdits := []
    Loop 4 {
        idx := A_Index
        StartupGui.AddText("y+8", "Slot " idx ":")
        slotEdit := StartupGui.AddEdit("w500", Slots[idx])
        SlotEdits.Push(slotEdit)

        btn := StartupGui.AddButton("x+m", "Sfoglia...")
        btn.OnEvent("Click", MakeSlotPicker(idx, slotEdit))
    }

    btnStart := StartupGui.AddButton("y+18 w120", "Avvia loop")
    btnCancel := StartupGui.AddButton("x+m w120", "Annulla")

    btnStart.OnEvent("Click", HandleStartClick)
    btnCancel.OnEvent("Click", HandleCancelClick)
}

HandleBrowseBase(*) {
    global BaseDir, BaseDirEdit
    dir := DirSelect("Seleziona directory base", 1, BaseDir ? BaseDir : A_ScriptDir)
    if dir {
        BaseDir := dir
        BaseDirEdit.Value := dir
    }
}

HandleStartClick(*) {
    ValidateAndStart()
}

HandleCancelClick(*) {
    global StartupGui
    StartupGui.Hide()
    Notify("Configurazione annullata. Usa Ctrl+Alt+S per avviare il loop.")
}

MakeSlotPicker(idx, slotEdit) {
    return SlotPickerHandler.Bind(idx, slotEdit)
}

SlotPickerHandler(idx, slotEdit, *) {
    global BaseDir
    startDir := BaseDir ? BaseDir : A_ScriptDir
    filePath := FileSelect(1, startDir, "Seleziona file per Slot " idx, "Tutti i file (*.*)")
    if filePath {
        slotEdit.Value := filePath
    }
}

; ===== PERSISTENZA CONFIG =====
LoadConfigIntoState() {
    global CONFIG_PATH, BaseDir, Slots
    if FileExist(CONFIG_PATH) {
        try {
            BaseDir := IniRead(CONFIG_PATH, "General", "BaseDir", BaseDir)
            Loop 4 {
                Slots[A_Index] := IniRead(CONFIG_PATH, "Slots", "Slot" A_Index, "")
            }
        }
    }
}

SaveConfigFromState() {
    global CONFIG_PATH, BaseDir, Slots
    try {
        EnsureDir(CONFIG_PATH)
        IniWrite(BaseDir, CONFIG_PATH, "General", "BaseDir")
        Loop 4 {
            IniWrite(Slots[A_Index], CONFIG_PATH, "Slots", "Slot" A_Index)
        }
    }
}

EnsureDir(filePath) {
    dir := RegExReplace(filePath, "\\[^\\]*$")
    if (dir != "" && !DirExist(dir)) {
        DirCreate(dir)
    }
}

; ===== VALIDAZIONE E AVVIO =====
ValidateAndStart() {
    global BaseDirEdit, SlotEdits, BaseDir, Slots, isRunning, StartupGui

    BaseDir := Trim(BaseDirEdit.Value)
    if !BaseDir || !DirExist(BaseDir) {
        Notify("Seleziona una directory base valida.")
        return
    }

    nonEmpty := 0
    Loop 4 {
        s := Trim(SlotEdits[A_Index].Value)
        Slots[A_Index] := s
        if (s != "") {
            nonEmpty += 1
        }
    }

    if (nonEmpty = 0) {
        Notify("Inserisci almeno uno slot (file o URL).")
        return
    }

    invalid := []
    Loop 4 {
        s := Slots[A_Index]
        if (s = "") {
            continue
        }

        if IsUrl(s) {
            host := ExtractHost(s)
            if host && !Ping(host, 1000) {
                invalid.Push("Slot " A_Index ": host non raggiungibile (" host ").")
            }
        } else if !FileExist(s) {
            invalid.Push("Slot " A_Index ": file non trovato.")
        }
    }

    if (invalid.Length > 0) {
        warningText := "Avviso: "
        for i, msg in invalid {
            warningText .= (i = 1 ? "" : " ") msg
        }
        Notify(warningText)
    }

    SaveConfigFromState()
    StartupGui.Hide()

    if !isRunning {
        isRunning := true
        try {
            MainLoop()
        } catch as err {
            isRunning := false
            Notify("Errore in MainLoop: " err.Message)
        }
    } else {
        Notify("Il loop è già in esecuzione.")
    }
}

; ===== UTILITIES =====
HoldWithCancel(ms) {
    global isRunning
    if (ms <= 0) {
        return
    }

    step := 30
    startTick := A_TickCount
    while isRunning {
        elapsed := A_TickCount - startTick
        if (elapsed >= ms) {
            break
        }
        Sleep(Min(step, ms - elapsed))
    }
}

WinWaitPID(pid, timeoutMs := 8000) {
    endTick := A_TickCount + timeoutMs
    while (A_TickCount < endTick) {
        if WinExist("ahk_pid " pid) {
            return true
        }
        Sleep(50)
    }
    return false
}

ExtractHost(url) {
    if RegExMatch(url, "i)^(?:https?|ftp)://([^/:]+)", &m) {
        return m[1]
    }
    return ""
}

Ping(host, timeoutMs := 1000) {
    if !host {
        return false
    }

    try {
        return RunWait("cmd.exe /c ping -n 1 -w " timeoutMs " " host, , "Hide") = 0
    }
    return false
}

IsUrl(text) {
    return !!RegExMatch(text, "i)^(?:https?|ftp)://")
}

IsImageFile(text) {
    return !!RegExMatch(text, "i)\.(png|jpg|jpeg|bmp|gif|webp)$")
}

ImageGetSize(filePath, &w, &h) {
    w := 0
    h := 0
    if !FileExist(filePath) {
        return
    }
    tmp := Gui("+ToolWindow")
    pic := tmp.AddPicture(, filePath)
    tmp.Show("Hide")
    w := pic.Pos.W
    h := pic.Pos.H
    tmp.Destroy()
}

Notify(msg) {
    ToolTip(msg)
    SetTimer(() => ToolTip(), -2500)
}

StopAll() {
    global isRunning
    isRunning := false
    CloseImage()
    CloseEdge()
    Notify("Loop arrestato")
}
