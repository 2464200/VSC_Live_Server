# Avvia un semplice HTTP server, apre le pagine Report e le sposta sul monitor secondario
# Usa Chrome se presente, altrimenti il browser di default

Add-Type -AssemblyName System.Windows.Forms

# Funzioni Win32 per spostare e massimizzare finestre
$signature = @'
using System;
using System.Runtime.InteropServices;
public static class Win32 {
    [DllImport("user32.dll")]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
'@
Add-Type $signature

# Trova lo schermo secondario (se non esiste usa il primario)
$screens = [System.Windows.Forms.Screen]::AllScreens
$secondary = $screens | Where-Object { -not $_.Primary } | Select-Object -First 1
if (-not $secondary) { $secondary = [System.Windows.Forms.Screen]::PrimaryScreen }
$bounds = $secondary.Bounds

# Avvia HTTP server (in background)
$pythonExe = "C:\VSC_Live_Server\.venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) { $pythonExe = "python" }
$server = Start-Process -FilePath $pythonExe -ArgumentList "-m","http.server","8000" -WorkingDirectory "C:\VSC_Live_Server" -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 1

$urls = @(
    "http://localhost:8000/Prova/Report.html",
    "http://localhost:8000/Prova/Report_white.html",
    "http://localhost:8000/Prova/Report_black.html"
)

# Tenta usare Chrome se presente
$chromePaths = @("C:\Program Files\Google\Chrome\Application\chrome.exe", "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe")
$chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

foreach ($url in $urls) {
    if ($chrome) {
        $proc = Start-Process -FilePath $chrome -ArgumentList "--new-window","--start-maximized",$url -PassThru
    } else {
        $proc = Start-Process -FilePath $url -PassThru
    }

    # Attendi che la finestra sia pronta
    $attempt = 0
    while ($attempt -lt 30) {
        try {
            $handle = $proc.MainWindowHandle
            if ($handle -ne 0) { break }
        } catch { }
        Start-Sleep -Milliseconds 300
        $attempt++
    }

    if ($handle -ne 0) {
        # Sposta e ridimensiona la finestra sullo schermo secondario
        [Win32]::MoveWindow($handle, $bounds.X, $bounds.Y, $bounds.Width, $bounds.Height, $true) | Out-Null
        # Massimizza
        [Win32]::ShowWindow($handle, 3) | Out-Null
    }
    Start-Sleep -Milliseconds 300
}

Write-Host "Opened reports on secondary monitor (if available)."