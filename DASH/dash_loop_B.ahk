
; =========================
; DASH LOOP (Enhanced + Startup Mask) - AutoHotkey v2.0+
; Single-Edge navigation, fullscreen images, 4 generic slots with persistence
; =========================

#Requires AutoHotkey v2.0
Persistent

; ===== CONFIGURAZIONE DI BASE =====
EDGE_PATHS     := [
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
]
EDGE_ARGS      := "--kiosk --inprivate --no-first-run --disable-features=TranslateUI --disable-session-crashed-bubble --overscroll-history-navigation=0"

; Durate default (ms) – puoi modificarle se vuoi tempi diversi per slot
SlotDurations  := [10000, 10000, 10000, 10000]

; Percorso config (INI) per memoria ultima scelta
CONFIG_PATH    := A_ScriptDir "\dashloop.ini"

; ===== STATO GLOBALE =====
isRunning  := false
edgePID    := 0
edgeHwnd   := 0
imageGui   := 0

; Selezioni correnti
BaseDir         := ""
Slots           := ["", "", "", ""]  ; 4 risorse (file locale o URL)
StartupGui      := 0
SlotEdits       := []  ; controlli Edit per i 4 slot
BaseDirEdit     := 0

; ===== HOTKEYS =====
^!s:: {
    global isRunning
    if !isRunning {
        ; Se non hai ancora fatto submit dalla maschera, cerca config e avvia
        if (Slots[1] = "" && Slots[2] = "" && Slots[3] = "" && Slots[4] = "")
            LoadConfigIntoState()
        isRunning := true
        MainLoop()
    }
}
^!x:: {
    StopAll()
}

; ===== AVVIO: Mostra maschera iniziale =====
BuildStartupGui()
StartupGui.Show()

; ===== MAIN LOOP =====
MainLoop() {
    global isRunning, Slots, SlotDurations

    if !EnsureEdge() {
        Notify("Edge non trovato o non avviabile.")
        isRunning := false
        return
    }

    while isRunning {
        ; Ciclo su 4 slot identici
        for idx, res in Slots {
            if !isRunning
                break

            dur := SlotDurations[idx]
            ShowResource(res, dur)
        }
    }

    ; Pulizia quando il loop termina
    CloseImage()
    CloseEdge()
}

; ===== MOSTRA UNA RISORSA (file locale immagine/HTML o URL) =====
ShowResource(resource, duration) {
    global isRunning

    if !isRunning
        return

    if resource = ""
    {
        ; Slot vuoto: solo attesa
        HoldWithCancel(duration)
        return
    }

    if IsImageFile(resource) {
        ; Immagine locale (richiede esistenza file)
        if !IsUrl(resource) && !FileExist(resource) {
            Notify("Immagine non trovata: " resource)
            HoldWithCancel(1000)
            return
        }
        ShowImageFullscreen(resource, duration)
        return
    }

    ; HTML/URL: se è URL, prova ping; se è file locale, verifica esistenza
    if IsUrl(resource) {
        host := ExtractHost(resource)
        if host && !Ping(host) {
            ; Host non raggiungibile: attesa "silenziosa"
            HoldWithCancel(duration)
            return
        }
        NavigateAndHold(resource, duration)
    } else {
        if !FileExist(resource) {
            Notify("File non trovato: " resource)
            HoldWithCancel(1000)
            return
        }
        NavigateAndHold(resource, duration)
    }
}

; ===== EDGE MANAGEMENT =====
EnsureEdge() {
    global edgePID, edgeHwnd

    if (edgePID && ProcessExist(edgePID)) {
        ; Aggiorna handle
        hwnd := WinExist("ahk_pid " edgePID)
        if hwnd {
            edgeHwnd := hwnd
            return true
        }
    }

    edgeExe := DetectEdgePath()
    if !edgeExe
        return false

    ; Avvia una pagina neutra in kiosk e riusa la stessa finestra
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
    for p in EDGE_PATHS
        if FileExist(p)
            return p
    return ""
}

CloseEdge() {
    global edgePID, edgeHwnd
    if (edgePID <= 0)
        return

    try ProcessClose(edgePID)
    Sleep(200)

    if ProcessExist(edgePID) {
        try Run("taskkill /F /PID " edgePID " /T", , "Hide")
    }
    edgePID := 0
    edgeHwnd := 0
}

; ===== NAVIGAZIONE (RIUSA STESSA FINESTRA) =====
NavigateAndHold(pathOrUrl, duration) {
    global isRunning, edgePID, edgeHwnd

    if !isRunning
        return

    if !(edgePID && ProcessExist(edgePID))
        if !EnsureEdge()
            return

    ; Converti file locale in file:///
    displayPath := pathOrUrl
    if !IsUrl(pathOrUrl) {
        displayPath := "file:///" . StrReplace(pathOrUrl, "\", "/")
    }

    if edgeHwnd
        WinActivate("ahk_id " edgeHwnd)

    ; Prova navigazione via Ctrl+L, incolla, Enter
    Send("^l")
    Sleep(100)
    A_Clipboard := ""
    A_Clipboard := displayPath
    ClipWait(1)
    Send("^v{Enter}")

    ; Breve attesa di assestamento + durata slot
    HoldWithCancel(500)
    HoldWithCancel(duration)
}

; ===== IMMAGINI FULLSCREEN =====
ShowImageFullscreen(imagePath, duration) {
    global imageGui, isRunning

    if !FileExist(imagePath) {
        Notify("Immagine non trovata: " imagePath)
        HoldWithCancel(1000)
        return
    }

    CloseImage()

    ; GUI borderless, always-on-top, full screen
    imageGui := Gui("+AlwaysOnTop -Caption +ToolWindow")
    imageGui.BackColor := "000000"

    sw := A_ScreenWidth
    sh := A_ScreenHeight

    try {
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
        if IsObject(imageGui)
            imageGui.Destroy()
    }
    imageGui := 0
}

; ===== MASCHERA INIZIALE =====

; ==== Stato e costanti globali ====
global CONFIG_PATH := A_ScriptDir "\dashloop.ini"
global BaseDir := ""
global Slots := ["", "", "", ""]    ; Array 1-based
global isRunning := false

; Handle GUI references globali
global StartupGui, BaseDirEdit, SlotEdits

; Default di BaseDir se non impostato
if !BaseDir
    BaseDir := A_ScriptDir

; ==== GUI INIZIALE ====
BuildStartupGui() {
    global StartupGui, BaseDirEdit, SlotEdits, Slots, BaseDir

    StartupGui := Gui("+AlwaysOnTop +Caption +ToolWindow", "DASH LOOP - Configurazione iniziale")
    StartupGui.MarginX := 16
    StartupGui.MarginY := 12

    ; Carica config se presente
    LoadConfigIntoState()

    ; Directory base
    StartupGui.AddText(, "Directory base (dove sono salvati i file):")
    BaseDirEdit := StartupGui.AddEdit("w500", BaseDir)
    browseBase := StartupGui.AddButton("x+m", "Sfoglia...")
    browseBase.OnEvent("Click", (*) => {
        dir := DirSelect("Seleziona directory base", 1, BaseDir ? BaseDir : A_ScriptDir)
        if dir {
            BaseDir := dir
            BaseDirEdit.Value := dir
        }
    })

    StartupGui.AddText("y+10", "Slot (file locale o URL). I 4 slot sono identici e verranno ripetuti in loop:")

    ; 4 slot identici, sovrapposti (stack verticale)
    SlotEdits := []
    Loop 4 {
        idx := A_Index
        StartupGui.AddText("y+8", "Slot " idx ":")
        edit := StartupGui.AddEdit("w500", Slots[idx])
        SlotEdits.Push(edit)

        ; IMPORTANTE: catturare idx ed edit nella closure
        btn := StartupGui.AddButton("x+m", "Sfoglia...")
        btn.OnEvent("Click", MakeSlotPicker(idx, edit))
    }

    ; Pulsanti Avvia/Annulla
    btnStart := StartupGui.AddButton("y+18 w120", "Avvia loop")
    btnCancel := StartupGui.AddButton("x+m w120", "Annulla")

    btnStart.OnEvent("Click", (*) => {
        ValidateAndStart()
    })

    btnCancel.OnEvent("Click", (*) => {
        StartupGui.Hide()
        Notify("Configurazione annullata. Usa Ctrl+Alt+S per avviare il loop.")
    })
}

; Closure factory per catturare correttamente l'idx e l'edit del loop
MakeSlotPicker(idx, edit) {
    return (*) => {
        startDir := BaseDir ? BaseDir : A_ScriptDir
        f := FileSelect(1, startDir, "Seleziona file per Slot " idx, "Tutti i file (*.*)")
        if f {
            edit.Value := f
        }
    }
}

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

EnsureDir(path) {
    ; Crea la directory del file se non esiste
    dir := RegExReplace(path, "\\[^\\]*$") ; rimuove il nome file
    if !DirExist(dir)
        DirCreate(dir)
}

; ===== VALIDAZIONE E AVVIO =====
ValidateAndStart() {
    global BaseDirEdit, SlotEdits, BaseDir, Slots, isRunning

    BaseDir := Trim(BaseDirEdit.Value)
    if !BaseDir || !DirExist(BaseDir) {
        Notify("Seleziona una directory base valida.")
        return
    }

    ; Leggi e pulisci i 4 slot
    nonEmpty := 0
    Loop 4 {
        s := Trim(SlotEdits[A_Index].Value)
        Slots[A_Index] := s
        if s != ""
            nonEmpty++
    }

    if nonEmpty = 0 {
        Notify("Inserisci almeno uno slot (file o URL).")
        return
    }

    ; Opzionale: validazione basilare su file/URL per feedback rapido
    ; (non blocca l'avvio, ma segnala)
    invalid := []
    Loop 4 {
        s := Slots[A_Index]
        if s != "" {
            if IsUrl(s) {
                host := ExtractHost(s)
                if host && !Ping(host, 1000) {
                    invalid.Push("Slot " A_Index ": host non raggiungibile (" host ").")
                }
            } else {
                if !FileExist(s) {
                    invalid.Push("Slot " A_Index ": file non trovato.")
                }
            }
        }
    }
    if invalid.Length {
        Notify("Avviso:\n" invalid.Join(" "))
    }

    ; Salva config e avvia
    SaveConfigFromState()
    StartupGui.Hide()

    if !isRunning {
        isRunning := true
        ; Avvia loop
        if IsSet(MainLoop) {
            try {
                MainLoop()
            } catch e {
                isRunning := false
                Notify("Errore in MainLoop: " e.Message)
            }
        } else {
            isRunning := false
            Notify("MainLoop non definito. Definisci la funzione MainLoop() per avviare il loop.")
        }
    } else {
        Notify("Il loop è già in esecuzione.")
    }
}

; ===== UTILITIES =====
HoldWithCancel(ms) {
    global isRunning
    if ms <= 0
        return
    step := 30
    t := A_TickCount
    while (isRunning) {
        elapsed := A_TickCount - t
        if (elapsed >= ms)
            break
        Sleep(Min(step, ms - elapsed))
    }
}

WinWaitPID(pid, timeoutMs := 8000) {
    end := A_TickCount + timeoutMs
    while (A_TickCount < end) {
        if WinExist("ahk_pid " pid)
            return true
        Sleep(50)
    }
    return false
}

ExtractHost(url) {
    if (RegExMatch(url, "i)^(?:https?|ftp)://([^/:]+)", &m))
        return m[1]
    return ""
}

Ping(host, timeoutMs := 1000) {
    if !host
        return false
    try {
        ; Usa solo exit code: 0 = successo
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
    ; Metodo leggero usando una GUI temporanea (solo file locali)
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
    SetTimer(() => ToolTip(), -2500)
}

CloseImage() {
    ; Placeholder: chiudi visualizzatore immagini se previsto
    ; Implementa secondo il tuo viewer
}

CloseEdge() {
    ; Placeholder: chiudi Edge se previsto
    ; Implementa secondo il tuo uso
}

StopAll() {
    global isRunning
    isRunning := false
    CloseImage()
    CloseEdge()
    Notify("Loop arrestato")
}

; ==== Hotkeys utili (facoltativi) ====
^!s:: ; Ctrl+Alt+S avvia il loop (se GUI già configurata)
if !isRunning {
    isRunning := true
    if IsSet(MainLoop) {
        try MainLoop()
        catch e {
            isRunning := false
            Notify("Errore in MainLoop: " e.Message)
        }
    } else {
        isRunning := false
        Notify("MainLoop non definito.")
    }
} else {
    Notify("Il loop è già in esecuzione.")
}
return

^!x:: ; Ctrl+Alt+X arresta tutto
StopAll()
return

; ==== Avvio GUI all'esecuzione ====
BuildStartupGui()
StartupGui.Show()

; ===== MESSAGGIO AVVIO =====
Notify("DASH LOOP pronto. La maschera di configurazione è aperta.")
