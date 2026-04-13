param([string]$FilePath, [string]$Viewer = 'auto', [string]$AdobePath = '')

# Logging
$logFile = "c:\VSC_Live_Server\pdf-open.log"

# Rotate log if > 5MB
try {
    if (Test-Path $logFile) {
        $sz = (Get-Item $logFile).Length
        if ($sz -gt 5MB) {
            $bak = "$logFile.$((Get-Date).ToString('yyyyMMdd_HHmmss'))"
            Move-Item -Path $logFile -Destination $bak -Force
        }
    }
} catch {
    # ignore rotation errors
}

function Log([string]$msg) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
    $fullMsg = "[$timestamp] $msg"
    Write-Host $fullMsg
    Add-Content -Path $logFile -Value $fullMsg -Encoding UTF8 2>$null
}

try {
    Log "=== INIZIO Apertura PDF: $FilePath (Viewer=$Viewer) ==="

    # Define Windows API helpers
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class WindowManager {
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    public const uint SWP_NOSIZE = 1;
    public const uint SWP_NOZORDER = 4;
    public const uint SWP_SHOWWINDOW = 64;
    public const int SW_SHOWMAXIMIZED = 3;
}
"@ -ErrorAction Stop

    Add-Type -AssemblyName System.Windows.Forms | Out-Null

    Log "Rilevamento monitor..."
    $screens = [System.Windows.Forms.Screen]::AllScreens
    Log "Monitor totali: $($screens.Count)"

    # Helper to start process
    function Start-Viewer($exePath, $args) {
        try {
            if ($args) {
                return Start-Process -FilePath $exePath -ArgumentList $args -PassThru
            } else {
                return Start-Process -FilePath $exePath -PassThru
            }
        } catch {
            try { Log ("ERRORE avvio processo " + $exePath + ": " + $_.ToString()) } catch { }
            return $null
        }
    }

    if ($screens.Count -lt 2) {
        Log "Un solo monitor - apertura normale"
        if ($Viewer -eq 'adobe') {
            if ($AdobePath -and (Test-Path $AdobePath)) {
                Log "Avvio Acrobat (single) da: $AdobePath"
                $proc = Start-Viewer $AdobePath @($FilePath)
            } else {
                Log "AdobePath non fornito o non valido, avvio con viewer di default"
                $proc = Start-Viewer $FilePath
            }
        } else {
            $proc = Start-Viewer $FilePath
        }
        Log "Processo avviato"

        # Force fullscreen even on single monitor
        if ($proc) {
            $procId = $proc.Id
            Log "   Processo avviato con PID: $procId"

            # Output JSON to stdout
            try {
                $info = @{ pid = $procId; file = $FilePath }
                $json = $info | ConvertTo-Json -Compress
                Write-Output $json
            } catch {
                try { Write-Output ($procId) } catch { }
            }

            # Wait for window and maximize
            Log "Attesa finestra per massimizzazione (5s max)..."
            $pdfWindow = $null
            for ($i = 0; $i -lt 50; $i++) {
                Start-Sleep -Milliseconds 100
                try { $proc.Refresh() } catch {}
                $hwnd = $proc.MainWindowHandle
                if ($null -ne $hwnd -and $hwnd -ne [IntPtr]::Zero) {
                    $pdfWindow = $hwnd
                    break
                }
            }

            if ($pdfWindow) {
                try {
                    Log "Forzo schermo intero su monitor singolo..."
                    [WindowManager]::ShowWindow($pdfWindow, [WindowManager]::SW_SHOWMAXIMIZED) | Out-Null
                    Log "✅ Finestra massimizzata su monitor singolo"
                } catch {
                    Log "❌ Errore massimizzazione singolo monitor: $_"
                }
            } else {
                Log "⚠️  Finestra non trovata per massimizzazione singolo monitor"
            }
        }
    } else {
        Log "Monitor secondario rilevato - apertura su monitor 2..."
        $secondary = $screens[1]
        $x = $secondary.WorkingArea.X
        $y = $secondary.WorkingArea.Y
        $w = $secondary.WorkingArea.Width
        $h = $secondary.WorkingArea.Height
        Log "   Monitor 2: X=$x Y=$y W=$w H=$h"

        # Start viewer according to preference
        $proc = $null
        if ($Viewer -eq 'adobe') {
            if ($AdobePath -and (Test-Path $AdobePath)) {
                Log "Avvio Acrobat da percorso custom: $AdobePath"
                # Try to request fullscreen and hide toolbar via /A parameter
                $args = @('/A', 'toolbar=0&navpanes=0&pagemode=FullScreen', $FilePath)
                $proc = Start-Viewer $AdobePath $args
            } else {
                # Try known installations
                $candidates = @(
                    'C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe',
                    'C:\Program Files (x86)\Adobe\Acrobat Reader DC\Reader\AcroRd32.exe',
                    'C:\Program Files\Adobe\Acrobat Reader DC\Reader\AcroRd32.exe'
                )
                $started = $false
                foreach ($c in $candidates) {
                    if (Test-Path $c) {
                        Log "Avvio Acrobat da candidato: $c (richiesta fullscreen)"
                        $args = @('/A', 'toolbar=0&navpanes=0&pagemode=FullScreen', $FilePath)
                        $proc = Start-Viewer $c $args
                        $started = $true
                        break
                    }
                }
                if (-not $started) {
                    Log "Acrobat non trovato, uso viewer di default"
                    $proc = Start-Viewer $FilePath
                }
            }
        } else {
            $proc = Start-Viewer $FilePath
        }

        if ($null -eq $proc) {
            Log "ERRORE: processo non avviato"
        } else {
                $procId = $proc.Id
                Log "   Processo avviato con PID: $procId"

                # Output JSON to stdout so the server can capture PID
                try {
                    $info = @{ pid = $procId; file = $FilePath }
                    $json = $info | ConvertTo-Json -Compress
                    Write-Output $json
                } catch {
                    try { Write-Output ($procId) } catch { }
                }

            # Memorizza la finestra precedente
            $prevWindow = [WindowManager]::GetForegroundWindow()
            Log "Finestra precedente: $prevWindow"

            # Attesa fino a 15 secondi
            Log "Attesa finestra (15s max)..."
            $pdfWindow = $null
            $found = $false
            for ($i = 0; $i -lt 150; $i++) {
                Start-Sleep -Milliseconds 100
                try { $proc.Refresh() } catch {}

                $hwnd = $proc.MainWindowHandle
                if ($null -ne $hwnd -and $hwnd -ne [IntPtr]::Zero) {
                    Log "MainWindowHandle trovato dopo $($i*100)ms: $($hwnd.ToInt64())"
                    $pdfWindow = $hwnd
                    $found = $true
                    break
                }

                $fg = [WindowManager]::GetForegroundWindow()
                if ($fg -ne $prevWindow -and $fg -ne [IntPtr]::Zero) {
                    Log "Finestra foreground cambiata dopo $($i*100)ms: $fg"
                    $pdfWindow = $fg
                    $found = $true
                    break
                }

                if ($i % 20 -eq 0 -and $i -gt 0) {
                    Log "   [Attesa $($i*100)ms] MainWindowHandle: $(if ($null -eq $hwnd) { 'null' } else { $hwnd.ToInt64() })"
                }
            }

            if ($found -and $null -ne $pdfWindow -and $pdfWindow -ne [IntPtr]::Zero) {
                Log "✅ Finestra PDF trovata: $($pdfWindow.ToInt64())"
                Log "Esecuzione SetWindowPos per spostamento al monitor 2..."
                $flags = [WindowManager]::SWP_SHOWWINDOW -bor [WindowManager]::SWP_NOZORDER
                try {
                    $result = [WindowManager]::SetWindowPos($pdfWindow, [IntPtr]::Zero, $x, $y, $w, $h, $flags)
                    if ($result) {
                        Log "✅ SetWindowPos SUCCESS - Finestra spostata al monitor secondario"
                    } else {
                        Log "⚠️  SetWindowPos ritorna FALSE"
                    }
                } catch {
                    Log "❌ ERRORE SetWindowPos: $_"
                }

                # Force fullscreen for all viewers
                try {
                    Log "Forzo schermo intero per tutti i viewer..."
                    [WindowManager]::ShowWindow($pdfWindow, [WindowManager]::SW_SHOWMAXIMIZED) | Out-Null
                    Log "✅ ShowWindow(SW_SHOWMAXIMIZED) chiamato per schermo intero"
                } catch {
                    Log "❌ Errore ShowWindow: $_"
                }
            } else {
                Log "⚠️  Finestra PDF non trovata dopo 15 secondi"
                Log "   Causa probabile: lettore PDF moderno (Edge/Chrome) che non espone window handle"
                Log "   SOLUZIONE: Sposta manualmente il PDF al monitor secondario"
            }
        }
    }

    Log "=== FINE Apertura PDF ==="
} catch {
    Log "❌ ERRORE: $_"
    Log "Exception: $($_.Exception.Message)"
}
