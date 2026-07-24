# Apre Bordero/pages/display.html sul monitor secondario (se presente), altrimenti sul primario.
# Usa Chrome se installato; in fallback usa il browser di default.

param(
    [string]$BaseUrl = "http://localhost:5500",
    [string]$Path = "/Bordero/pages/display.html"
)

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

$helpers = Join-Path $PSScriptRoot 'scripts\ps_helpers.ps1'
if (Test-Path $helpers) { . $helpers }

if (-not (Get-Command -Name Start-ProcessSafe -ErrorAction SilentlyContinue)) {
    function Start-ProcessSafe {
        param(
            [Parameter(Mandatory = $true)][string]$FilePath,
            [string[]]$ArgumentList,
            [switch]$PassThru
        )

        if ($PassThru) {
            return Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -PassThru
        }

        Start-Process -FilePath $FilePath -ArgumentList $ArgumentList | Out-Null
        return $null
    }
}

# Screen target
$screens = [System.Windows.Forms.Screen]::AllScreens
$secondary = $screens | Where-Object { -not $_.Primary } | Select-Object -First 1
if (-not $secondary) { $secondary = [System.Windows.Forms.Screen]::PrimaryScreen }
$bounds = $secondary.Bounds

$url = ($BaseUrl.TrimEnd('/')) + $Path

$chromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)
$chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chrome) {
    $args = @(
        '--new-window',
        '--kiosk',
        "--window-position=$($bounds.X),$($bounds.Y)",
        "--window-size=$($bounds.Width),$($bounds.Height)",
        $url
    )
    $proc = Start-ProcessSafe -FilePath $chrome -ArgumentList $args -PassThru

    if ($proc) {
        $handle = [IntPtr]::Zero
        for ($i = 0; $i -lt 30; $i++) {
            try { $handle = $proc.MainWindowHandle } catch {}
            if ($handle -ne [IntPtr]::Zero) { break }
            Start-Sleep -Milliseconds 200
        }

        if ($handle -ne [IntPtr]::Zero) {
            [Win32]::MoveWindow($handle, $bounds.X, $bounds.Y, $bounds.Width, $bounds.Height, $true) | Out-Null
            [Win32]::ShowWindow($handle, 3) | Out-Null
        }
    }

    Write-Host "Display aperto su monitor secondario (se disponibile): $url"
    exit 0
}

# Fallback browser di default
Start-ProcessSafe -FilePath $url
Write-Host "Chrome non trovato: aperto browser di default. URL: $url"
