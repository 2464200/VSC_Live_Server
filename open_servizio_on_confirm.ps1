Add-Type -AssemblyName System.Windows.Forms

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

# Chiedi conferma all'utente
$msg = "Aprire servizio.html sul monitor secondario?"
$title = "Apri servizio.html"
$res = [System.Windows.Forms.MessageBox]::Show($msg, $title, [System.Windows.Forms.MessageBoxButtons]::YesNo, [System.Windows.Forms.MessageBoxIcon]::Question)
if ($res -ne [System.Windows.Forms.DialogResult]::Yes) { exit }

$root = "C:\VSC_Live_Server"

# trova schermo secondario
$screens = [System.Windows.Forms.Screen]::AllScreens
$secondary = $screens | Where-Object { -not $_.Primary } | Select-Object -First 1
if (-not $secondary) { $secondary = [System.Windows.Forms.Screen]::PrimaryScreen }
$bounds = $secondary.Bounds

# Avvia http.server se non in esecuzione
$httpRunning = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'http\.server' -or $_.CommandLine -match 'SimpleHTTPServer' }
if (-not $httpRunning) {
    $pythonExe = "C:\VSC_Live_Server\.venv\Scripts\python.exe"
    if (-not (Test-Path $pythonExe)) { $pythonExe = "python" }
    Start-Process -FilePath $pythonExe -ArgumentList '-m','http.server','8000' -WorkingDirectory $root -WindowStyle Hidden | Out-Null
    Start-Sleep -Seconds 1
}

$url = "http://localhost:8000/servizio.html"

# Usa Chrome se disponibile
$chromePaths = @("C:\Program Files\Google\Chrome\Application\chrome.exe", "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe")
$chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chrome) {
    $proc = Start-Process -FilePath $chrome -ArgumentList '--new-window', $url -PassThru
} else {
    $proc = Start-Process -FilePath $url -PassThru
}

# Attendi handle finestra
$handle = 0
for ($i=0; $i -lt 30; $i++) {
    try { $handle = $proc.MainWindowHandle } catch {}
    if ($handle -ne 0 -and $handle -ne [IntPtr]::Zero) { break }
    Start-Sleep -Milliseconds 300
}

# Se non trovato, prova a cercare finestra con titolo
if ($handle -eq 0 -or $handle -eq [IntPtr]::Zero) {
    Start-Sleep -Seconds 1
    $procs = Get-Process -Name chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match 'servizio2' }
    if ($procs) { $proc = $procs[0]; $handle = $proc.MainWindowHandle }
}

if ($handle -ne 0 -and $handle -ne [IntPtr]::Zero) {
    try {
        [Win32]::MoveWindow($handle, $bounds.X, $bounds.Y, $bounds.Width, $bounds.Height, $true) | Out-Null
        [Win32]::ShowWindow($handle, 3) | Out-Null
    } catch {}
}

Write-Host "Servizio aperto (se selezionato)."
