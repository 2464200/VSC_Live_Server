; =========================
; DASH LOOP - AutoHotkey v2.0.19
; Simple, robust kiosk presentation loop
; =========================

#Requires AutoHotkey v2.0
Persistent

; ===== CONFIGURATION =====
BROWSER := "edge"
EDGE_PATH := "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
ASSETS_DIR := "C:\VSC_Live_Server\DASH\assets"

; --- URL PRINCIPALI IDENTICI AI TUOI ---
FILE1_PRIMARY := "http://192.168.1.157:5500/Index.html"
IMAGE := ASSETS_DIR . "\foto.jpg"
FILE2_PRIMARY := "http://192.168.1.157:5500/NextCoreo1.html"
REMOTE_URL_PRIMARY := "http://192.168.1.157:5500/NextCoreo1.html"

; --- URL ALTERNATIVI (AGGIUNGILI TU COME SERVE) ---
FILE1_ALT := "http://192.168.1.157:5501/Index.html"
FILE2_ALT := "http://192.168.1.157:5501/NextCoreo1.html"
REMOTE_URL_ALT := "http://192.168.1.157:5501/NextCoreo1.html"
; IMAGE non richiede fallback


; --- Funzione che sceglie il primo URL valido ---
GetAvailableUrl(primary, alt) {
    if UrlIsReachable(primary)
        return primary

    if UrlIsReachable(alt)
        return alt

    return ""   ; nessuno valido
}

; --- Funzione HEAD per controllo raggiungibilità ---
UrlIsReachable(url) {
    try {
        req := ComObject("WinHttp.WinHttpRequest.5.1")
        req.Open("HEAD", url, false)
        req.Send()
        return req.Status = 200
    } catch {
        return false
    }
}

; --- OTTENIMENTO DEGLI URL FINALI ---
FILE1 := GetAvailableUrl(FILE1_PRIMARY, FILE1_ALT)
FILE2 := GetAvailableUrl(FILE2_PRIMARY, FILE2_ALT)
REMOTE_URL := GetAvailableUrl(REMOTE_URL_PRIMARY, REMOTE_URL_ALT)
; IMAGE rimane invariata

; --- DEBUG OUTPUT ---
MsgBox(
      "FILE1 -> " FILE1 "`n"
    . "IMAGE -> " IMAGE "`n"
    . "FILE2 -> " FILE2 "`n"
    . "REMOTE_URL -> " REMOTE_URL
)


DURATION_FILE1 := 10000   ; milliseconds
DURATION_IMAGE := 10000
DURATION_FILE2 := 10000
DURATION_REMOTE := 10000

; ===== GLOBAL STATE =====
isRunning := false
currentPID := 0
imageGui := 0

; ===== HOTKEYS =====
^!s:: {
    global isRunning
    if (!isRunning) {
        isRunning := true
        MainLoop()
    }
}

^!x:: {
    global isRunning, currentPID, imageGui
    isRunning := false
    
    ; Close browser
    if (currentPID > 0) {
        try ProcessClose(currentPID)
        try Run("taskkill /F /IM msedge.exe /T", , "Hide")
        currentPID := 0
    }
    
    ; Close image
    if (IsObject(imageGui)) {
        try imageGui.Destroy()
        imageGui := 0
    }
}

; ===== MAIN LOOP =====
MainLoop() {
    global isRunning, currentPID, imageGui, DURATION_FILE1, DURATION_IMAGE
    global DURATION_FILE2, DURATION_REMOTE, FILE1, IMAGE, FILE2, REMOTE_URL
    
    while (isRunning) {
        ; 1. Show HTML file 1
        if (isRunning) {
            ShowFile(FILE1, DURATION_FILE1)
        }
        
        ; 2. Show image
        if (isRunning) {
            ShowImage(IMAGE, DURATION_IMAGE)
        }
        
        ; 3. Show HTML file 2
        if (isRunning) {
            ShowFile(FILE2, DURATION_FILE2)
        }
        
        ; 4. Show remote URL (if reachable)
        if (isRunning) {
            host := ExtractHost(REMOTE_URL)
            if (Ping(host)) {
                ShowFile(REMOTE_URL, DURATION_REMOTE)
            } else {
                Sleep(DURATION_REMOTE)
            }
        }
    }
}

; ===== SHOW FILE (HTML or URL) =====
ShowFile(resource, duration) {
    global isRunning, currentPID, EDGE_PATH
    
    ; Verify file exists (if local)
    if (!(InStr(resource, "http")) && !(FileExist(resource))) {
        ToolTip("File not found: " . resource)
        Sleep(1000)
        ToolTip()
        return
    }
    
    ; Convert to file:// if local
    displayPath := resource
    if (!InStr(resource, "http")) {
        displayPath := "file:///" . StrReplace(resource, "\", "/")
    }
    
    ; Close previous Edge instance
    CloseBrowser()
    Sleep(500)
    
    ; Build command - ALWAYS launch new Edge for each file
    cmd := '"' . EDGE_PATH . '" --kiosk --inprivate "' . displayPath . '"'
    
    ; Launch Edge
    try {
        currentPID := Run(cmd, , "Hide")
    } catch as err {
        ToolTip("Error launching Edge: " . err.Message)
        Sleep(1000)
        ToolTip()
        return
    }
    
    ; Wait for window to appear
    loop 50 {
        if (WinExist("ahk_class Chrome_WidgetWin_1")) {
            Sleep(500)  ; Extra wait for page to load
            break
        }
        Sleep(100)
    }
    
    ; Sleep while running
    elapsed := 0
    while (elapsed < duration && isRunning) {
        Sleep(100)
        elapsed += 100
    }
    
    CloseBrowser()
}

; ===== SHOW IMAGE FULLSCREEN =====
ShowImage(imagePath, duration) {
    global isRunning, imageGui
    
    if (!FileExist(imagePath)) {
        ToolTip("Image not found: " . imagePath)
        Sleep(1000)
        ToolTip()
        return
    }
    
    ; Create GUI with image at normal size
    imageGui := Gui("+AlwaysOnTop -Caption +ToolWindow")
    imageGui.BackColor := "000000"
    imageGui.AddPicture(, imagePath)
    imageGui.Show()
    
    ; Sleep while running
    elapsed := 0
    while (elapsed < duration && isRunning) {
        Sleep(100)
        elapsed += 100
    }
    
    ; Cleanup
    try {
        if (IsObject(imageGui))
            imageGui.Destroy()
    }
    imageGui := 0
}

; ===== HELPER: Close Browser =====
CloseBrowser() {
    global currentPID
    
    if (currentPID <= 0)
        return
    
    try ProcessClose(currentPID)
    Sleep(300)
    
    try {
        if (ProcessExist(currentPID))
            Run("taskkill /F /PID " . currentPID . " /T", , "Hide")
    }
    
    currentPID := 0
    Sleep(300)
}

; ===== HELPER: Extract Host from URL =====
ExtractHost(url) {
    if (RegExMatch(url, "i)^(?:https?|ftp)://([^/:]+)", &match)) {
        return match[1]
    }
    return ""
}

; ===== HELPER: Ping Host =====
Ping(host) {
    if (!host)
        return false
    
    try {
        exitCode := RunWait("cmd /c ping -n 1 -w 1000 " . host, , "Hide")
        return (exitCode = 0)
    }
    return false
}

; ===== STARTUP MESSAGE =====
ToolTip("DASH LOOP Ready`n`nCtrl+Alt+S = Start`nCtrl+Alt+X = Stop")
SetTimer(() => ToolTip(), -3000)
