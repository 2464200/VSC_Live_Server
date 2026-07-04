# Avvia http.server se non è in esecuzione, apre tutte le pagine .html del progetto
# e le sposta/massimizza sul monitor secondario (se presente).

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

$root = "C:\VSC_Live_Server"
# trova schermo secondario
$screens = [System.Windows.Forms.Screen]::AllScreens
$secondary = $screens | Where-Object { -not $_.Primary } | Select-Object -First 1
if (-not $secondary) { $secondary = [System.Windows.Forms.Screen]::PrimaryScreen }
$bounds = $secondary.Bounds

# verifica se http.server è in esecuzione
$httpRunning = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'http\.server' -or $_.CommandLine -match 'SimpleHTTPServer' }
    if (-not $httpRunning) {
    $pythonExe = "C:\VSC_Live_Server\.venv\Scripts\python.exe"
    if (-not (Test-Path $pythonExe)) { $pythonExe = "python" }
    $helpers = Join-Path $PSScriptRoot 'scripts\ps_helpers.ps1'
    if (Test-Path $helpers) { . $helpers }
    Start-ProcessSafe -FilePath $pythonExe -ArgumentList '-m','http.server','8000' -WorkingDirectory $root -WindowStyle Hidden | Out-Null
    Start-Sleep -Seconds 1
}

# trova chrome se esiste
$chromePaths = @("C:\Program Files\Google\Chrome\Application\chrome.exe", "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe")
$chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

# trova tutti i file .html (esclude cartelle comuni volatile)
$files = Get-ChildItem -Path $root -Filter *.html -Recurse | Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\.git\\' }

foreach ($file in $files) {
    $relative = $file.FullName.Substring($root.Length + 1) -replace '\\','/'
    $url = "http://localhost:8000/" + [System.Uri]::EscapeUriString($relative)

    if ($chrome) {
        $proc = Start-ProcessSafe -FilePath $chrome -ArgumentList '--new-window', '--start-maximized', $url -PassThru
    } else {
        $proc = Start-ProcessSafe -FilePath $url -PassThru
    }

    # aspetta che la finestra sia pronta
    $handle = 0
    for ($i=0; $i -lt 30; $i++) {
        try { $handle = $proc.MainWindowHandle } catch {}
        if ($handle -ne 0 -and $handle -ne [IntPtr]::Zero) { break }
        Start-Sleep -Milliseconds 300
    }

    # se handle non valido, prova a cercare una finestra con titolo che contiene il nome del file
    if ($handle -eq 0 -or $handle -eq [IntPtr]::Zero) {
        Start-Sleep -Seconds 1
        $procs = Get-Process -Name chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match ([System.Text.RegularExpressions.Regex]::Escape($file.BaseName)) }
        if ($procs) { $proc = $procs[0]; $handle = $proc.MainWindowHandle }
    }

    if ($handle -ne 0 -and $handle -ne [IntPtr]::Zero) {
        try {
            [Win32]::MoveWindow($handle, $bounds.X, $bounds.Y, $bounds.Width, $bounds.Height, $true) | Out-Null
            [Win32]::ShowWindow($handle, 3) | Out-Null
        } catch {}
    }

    Start-Sleep -Milliseconds 300
}

Write-Host "Apertura completa: $($files.Count) pagine HTML aperte e posizionate (se possibile)."