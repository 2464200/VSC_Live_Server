; =========================
; DASH LOOP UNIFIED - AutoHotkey v2.0
; Unisce le funzionalità di dash_loop_A.ahk, dash_loop_B.ahk e dash_loop_C.ahk
; =========================

#Requires AutoHotkey v2.0
Persistent

; ===== CONFIGURATION =====
EDGE_PATHS := [
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
]
EDGE_ARGS := "--kiosk --inprivate --no-first-run --disable-features=TranslateUI --disable-session-crashed-bubble --overscroll-history-navigation=0"
ASSETS_DIR := "C:\VSC_Live_Server\DASH\assets"
CONFIG_PATH := A_ScriptDir "\dashloop.ini"

SERVER_HOST := "127.0.0.1"
SERVER_PORT := "5500"
ALT_SERVER_PORT := "5501"

DEFAULT_SLOTS := [
    "http://" SERVER_HOST ":" SERVER_PORT "/Index2.html",
    ASSETS_DIR "\foto.jpg",
    ASSETS_DIR "\DJ_fiera_treviglio_2026.jpeg",
    "http://" SERVER_HOST ":" SERVER_PORT "/NextCoreo1.html",
    "http://" SERVER_HOST ":" SERVER_PORT "/NextCoreo2.html"
]

SlotDurations := [10000, 10000, 10000,10000, 10000]

; ===== GLOBAL STATE =====
isRunning := false
edgePID := 0
edgeHwnd := 0
imageGui := 0
BaseDir := A_ScriptDir
Slots := []
SlotEdits := []
StartupGui := 0
HostEdit := 0
PortEdit := 0
AltPortEdit := 0

; ===== HOTKEYS =====
^!s:: {
    global isRunning
    if !isRunning {
        if (Slots.Length() = 0)
            LoadConfigIntoState()
        if (Slots.Length() = 0)
            Slots := DEFAULT_SLOTS.Clone()
        StartDashLoopIfVlcIsStopped()
    }
}

^!x:: {
    StopAll()
}

; ===== STARTUP GUI =====
BuildStartupGui()
WaitForVlcThenShowGui()

BuildStartupGui() {
    global StartupGui, SlotEdits, HostEdit, PortEdit, AltPortEdit, BaseDir

    StartupGui := Gui("+AlwaysOnTop +Caption +ToolWindow", "DASH LOOP - Configurazione")
    StartupGui.MarginX := 14
    StartupGui.MarginY := 10

    StartupGui.AddText(, "Host/server:")
    HostEdit := StartupGui.AddEdit("w300", SERVER_HOST)
    StartupGui.AddText("y+8", "Porta principale:")
    PortEdit := StartupGui.AddEdit("w120", SERVER_PORT)
    StartupGui.AddText("x+12 y", "Porta alternativa:")
    AltPortEdit := StartupGui.AddEdit("w120", ALT_SERVER_PORT)

    StartupGui.AddText("y+14", "Slot 1..4: file locale o URL")
    SlotEdits := []
    Loop 4 {
        idx := A_Index
        StartupGui.AddText("y+8", "Slot " idx ":")
        edit := StartupGui.AddEdit("w520", Slots[idx] ? Slots[idx] : DEFAULT_SLOTS[idx])
        SlotEdits.Push(edit)
    }

    btnStart := StartupGui.AddButton("y+14 w120", "Avvia loop")
    btnSave := StartupGui.AddButton("x+m w120", "Salva config")
    btnCancel := StartupGui.AddButton("x+m w120", "Chiudi")

    btnStart.OnEvent("Click", () => {
        ValidateAndStart()
    })
    btnSave.OnEvent("Click", () => {
        ValidateAndSave()
    })
    btnCancel.OnEvent("Click", () => {
        StartupGui.Hide()
        Notify("Configurazione nascosta. Usa Ctrl+Alt+S per avviare.")
    })
}

LoadConfigIntoState() {
    global CONFIG_PATH, SERVER_HOST, SERVER_PORT, ALT_SERVER_PORT, BaseDir, Slots

    if FileExist(CONFIG_PATH) {
        SERVER_HOST := IniRead(CONFIG_PATH, "Server", "Host", SERVER_HOST)
        SERVER_PORT := IniRead(CONFIG_PATH, "Server", "Port", SERVER_PORT)
        ALT_SERVER_PORT := IniRead(CONFIG_PATH, "Server", "AltPort", ALT_SERVER_PORT)
        BaseDir := IniRead(CONFIG_PATH, "General", "BaseDir", BaseDir)
        Slots := []
        Loop 4 {
            slot := IniRead(CONFIG_PATH, "Slots", "Slot" A_Index, "")
            if slot != ""
                Slots.Push(slot)
        }
    }
}

ValidateAndSave() {
    global HostEdit, PortEdit, AltPortEdit, SlotEdits, CONFIG_PATH, SERVER_HOST, SERVER_PORT, ALT_SERVER_PORT, Slots, BaseDir

    host := Trim(HostEdit.Value)
    port := Trim(PortEdit.Value)
    altPort := Trim(AltPortEdit.Value)
    if !host
        host := SERVER_HOST
    if !port
        port := SERVER_PORT
    if !altPort
        altPort := ALT_SERVER_PORT

    SERVER_HOST := host
    SERVER_PORT := port
    ALT_SERVER_PORT := altPort

    Slots := []
    Loop 4 {
        SlotText := Trim(SlotEdits[A_Index].Value)
        if SlotText = ""
            SlotText := DEFAULT_SLOTS[A_Index]
        Slots.Push(SlotText)
    }

    EnsureDirectoryForFile(CONFIG_PATH)
    IniWrite(SERVER_HOST, CONFIG_PATH, "Server", "Host")
    IniWrite(SERVER_PORT, CONFIG_PATH, "Server", "Port")
    IniWrite(ALT_SERVER_PORT, CONFIG_PATH, "Server", "AltPort")
    IniWrite(BaseDir, CONFIG_PATH, "General", "BaseDir")
    Loop 4 {
        IniWrite(Slots[A_Index], CONFIG_PATH, "Slots", "Slot" A_Index)
    }
    Notify("Configurazione salvata")
}

ValidateAndStart() {
    global isRunning
    ValidateAndSave()
    StartupGui.Hide()
    StartDashLoopIfVlcIsStopped()
}

EnsureDirectoryForFile(path) {
    dir := RegExReplace(path, "\\[^\\]*$")
    if dir && !DirExist(dir)
        DirCreate(dir)
}

MainLoop() {
    global isRunning, Slots, SlotDurations

    if !EnsureEdge()
        return

    if Slots.Length() = 0
        Slots := DEFAULT_SLOTS.Clone()

    while isRunning {
        Loop Slots.Length() {
            if !isRunning
                break
            res := Slots[A_Index]
            dur := SlotDurations[A_Index] ? SlotDurations[A_Index] : 10000
            ShowResource(res, dur)
        }
    }

    CloseImage()
    CloseEdge()
}

ShowResource(resource, duration) {
    global isRunning
    if !isRunning
        return

    if resource = ""
    {
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
        if host && !Ping(host)
        {
            Notify("Host non raggiungibile: " host)
            HoldWithCancel(duration)
            return
        }
        NavigateAndHold(resource, duration)
        return
    }

    if FileExist(resource) {
        NavigateAndHold("file:///" . StrReplace(resource, "\\", "/"), duration)
        return
    }

    Notify("Risorsa non valida: " resource)
    HoldWithCancel(1000)
}

EnsureEdge() {
    global edgePID, edgeHwnd, EDGE_PATHS, EDGE_ARGS

    if (edgePID && ProcessExist(edgePID)) {
        hwnd := WinExist("ahk_pid " edgePID)
        if hwnd {
            edgeHwnd := hwnd
            return true
        }
    }

    if edgeHwnd && WinExist("ahk_id " edgeHwnd) {
        if (edgePID <= 0)
            edgePID := WinGetPID("ahk_id " edgeHwnd)
        return true
    }

    hwnd := FindExistingEdgeWindow()
    if hwnd {
        edgeHwnd := hwnd
        edgePID := WinGetPID("ahk_id " hwnd)
        return true
    }

    edgeExe := DetectEdgePath()
    if !edgeExe {
        Notify("Edge non trovato.")
        return false
    }

    cmd := '"' edgeExe '" ' EDGE_ARGS ' "about:blank"'
    try {
        edgePID := Run(cmd, , "Hide")
    } catch e {
        Notify("Errore avvio Edge: " e.Message)
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
    for path in EDGE_PATHS
        if FileExist(path)
            return path
    return ""
}

NavigateAndHold(pathOrUrl, duration) {
    global isRunning, edgePID, edgeHwnd

    if !isRunning
        return

    if edgeHwnd && !WinExist("ahk_id " edgeHwnd)
        edgeHwnd := 0

    if !edgeHwnd
        edgeHwnd := FindExistingEdgeWindow()

    if !(edgePID && ProcessExist(edgePID)) {
        if !EnsureEdge()
            return
    }

    if edgeHwnd
        WinActivate("ahk_id " edgeHwnd)

    Sleep(300)
    Send("^l")
    Sleep(150)
    A_Clipboard := ""
    A_Clipboard := pathOrUrl
    ClipWait(1)
    Send("^v{Enter}")

    HoldWithCancel(500)
    HoldWithCancel(duration)
}

ShowImageFullscreen(imagePath, duration) {
    global imageGui, isRunning

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
    iw := 0, ih := 0
    ImageGetSize(imagePath, &iw, &ih)
    if (iw > 0 && ih > 0) {
        scale := Min(sw/iw, sh/ih)
        tw := Round(iw*scale)
        th := Round(ih*scale)
        x := Round((sw - tw)/2)
        y := Round((sh - th)/2)
        imageGui.AddPicture("x" x " y" y " w" tw " h" th " +BackgroundTrans", imagePath)
    } else {
        imageGui.AddPicture("x0 y0 w" sw " h" sh " +BackgroundTrans", imagePath)
    }
    imageGui.Show("x0 y0 w" sw " h" sh)

    HoldWithCancel(duration)
    CloseImage()
}

CloseImage() {
    global imageGui
    if IsObject(imageGui) {
        try imageGui.Destroy()
    }
    imageGui := 0
}

CloseEdge() {
    global edgePID, edgeHwnd
    if (edgePID <= 0 && edgeHwnd)
        edgePID := WinGetPID("ahk_id " edgeHwnd)
    if (edgePID <= 0)
        return
    try ProcessClose(edgePID)
    Sleep(300)
    if ProcessExist(edgePID)
        Run("taskkill /F /PID " edgePID " /T", , "Hide")
    edgePID := 0
    edgeHwnd := 0
}

HoldWithCancel(ms) {
    global isRunning
    if (ms <= 0)
        return
    start := A_TickCount
    while (isRunning) {
        elapsed := A_TickCount - start
        if (elapsed >= ms)
            break
        Sleep(Min(80, ms - elapsed))
    }
}

ExtractHost(url) {
    if RegExMatch(url, "i)^(?:https?|ftp)://([^/:]+)", &m)
        return m[1]
    return ""
}

Ping(host, timeoutMs := 1000) {
    if !host
        return false
    try {
        return RunWait("cmd.exe /c ping -n 1 -w " timeoutMs " " host, , "Hide") = 0
    }
    return false
}

IsUrl(s) {
    return !!RegExMatch(s, "i)^(?:https?|ftp)://")
}

IsImageFile(s) {
    return !!RegExMatch(s, "i)\.(png|jpg|jpeg|bmp|gif|webp)$")
}

ImageGetSize(path, &w, &h) {
    w := 0, h := 0
    if !FileExist(path)
        return
    tmp := Gui("+ToolWindow")
    pic := tmp.AddPicture(, path)
    tmp.Show("Hide")
    w := pic.Pos.W
    h := pic.Pos.H
    tmp.Destroy()
}

Notify(msg) {
    ToolTip(msg)
    SetTimer(() => ToolTip(), -2600)
}

FindExistingEdgeWindow() {
    hwnd := WinExist("ahk_class Chrome_WidgetWin_1 ahk_exe msedge.exe")
    return hwnd ? hwnd : 0
}

StopAll() {
    global isRunning
    isRunning := false
    CloseImage()
    CloseEdge()
    Notify("Loop arrestato")
}

WaitForVlcThenShowGui() {
    if ProcessExist("vlc.exe") {
        Notify("VLC è attivo. GUI verrà mostrata al termine del video.")
        SetTimer("ShowGuiWhenVlcStops", 1000)
    } else {
        StartupGui.Show()
    }
}

ShowGuiWhenVlcStops() {
    if !ProcessExist("vlc.exe") {
        SetTimer("ShowGuiWhenVlcStops", "Off")
        Notify("VLC terminato. Attendo 10 secondi prima di mostrare la GUI.")
        Sleep(10000)
        StartupGui.Show()
        Notify("GUI attiva.")
    }
}

StartDashLoopIfVlcIsStopped() {
    global isRunning

    if VlcIsRunning() {
        Notify("VLC è attivo. Avvio DASH in attesa della fine del video.")
        SetTimer("StartDashLoopWhenVlcStops", 1000)
        return
    }

    if !isRunning {
        isRunning := true
        MainLoop()
    }
}

StartDashLoopWhenVlcStops() {
    global isRunning

    if VlcIsRunning()
        return

    SetTimer("StartDashLoopWhenVlcStops", "Off")
    Notify("VLC terminato. Attendo 10 secondi prima di avviare il DASH.")
    Sleep(10000)
    if !isRunning {
        isRunning := true
        MainLoop()
    }
}

VlcIsRunning() {
    return ProcessExist("vlc.exe")
}

MsgBox("DASH LOOP UNIFIED pronto. Usa Ctrl+Alt+S per avviare e Ctrl+Alt+X per fermare.")
