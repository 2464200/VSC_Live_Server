param([string]$FilePath, [string]$Viewer = 'auto', [string]$AdobePath = '')

# Questo script apre un PDF sul monitor secondario in modo robusto.
# - usa l'endpoint unificato /api/serve-pdf per servire il file via HTTP
# - avvia Chrome o Acrobat secondo il viewer richiesto
# - cerca window handle anche nei processi figli del viewer
# - applica tentativi di spostamento e massimizzazione sul monitor secondario
# - scrive un log dettagliato in c:\VSC_Live_Server\pdf-open.log

# Logging
$logFile = "c:\VSC_Live_Server\pdf-open.log"
$logDir = Split-Path $logFile -Parent

if (-not (Test-Path $logDir)) {
    try { New-Item -ItemType Directory -Path $logDir -Force | Out-Null } catch {}
}

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

    # Validazione file
    if (-not (Test-Path $FilePath)) {
        Log "❌ ERRORE: File PDF non trovato: $FilePath"
        throw "File non trovato: $FilePath"
    }

    Log "✅ File PDF trovato e valido"

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

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public const uint SWP_NOSIZE = 1;
    public const uint SWP_NOZORDER = 4;
    public const uint SWP_SHOWWINDOW = 64;
    public const int SW_SHOWMAXIMIZED = 3;
}
"@ -ErrorAction Stop

    # System.Windows.Forms è usato solo per rilevare i monitor disponibili
    Add-Type -AssemblyName System.Windows.Forms | Out-Null

    function Get-ChildProcessIds($pid) {
        # Include eventuali processi figli in cascata: utile per Chrome/Acrobat
        try {
            $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $pid }
            $ids = @()
            foreach ($child in $children) {
                $ids += $child.ProcessId
                $ids += Get-ChildProcessIds($child.ProcessId)
            }
            return $ids
        } catch {
            return @()
        }
    }

    function Get-WindowHandlesForPid($pid) {
        $handles = @()
        $callback = [WindowManager+EnumWindowsProc] {
            param($hWnd, $lParam)
            if (-not [WindowManager]::IsWindowVisible($hWnd)) { return $true }
            [int]$windowPid = 0
            [WindowManager]::GetWindowThreadProcessId($hWnd, [ref]$windowPid) | Out-Null
            if ($windowPid -eq $lParam.ToInt32()) {
                $handles += $hWnd
            }
            return $true
        }
        [WindowManager]::EnumWindows($callback, [IntPtr]::op_Explicit($pid)) | Out-Null
        return $handles
    }

    function Get-WindowHandlesForPidTree($rootPid) {
        $pids = @($rootPid) + (Get-ChildProcessIds $rootPid)
        $handles = @()
        foreach ($pid in $pids | Select-Object -Unique) {
            $handles += Get-WindowHandlesForPid $pid
        }
        return $handles | Select-Object -Unique
    }

    function Move-And-MaximizeWindow($hwnd, $x, $y, $w, $h) {
        try {
            $flags = [WindowManager]::SWP_SHOWWINDOW -bor [WindowManager]::SWP_NOZORDER
            [WindowManager]::SetWindowPos($hwnd, [IntPtr]::Zero, $x, $y, $w, $h, $flags) | Out-Null
            [WindowManager]::ShowWindow($hwnd, [WindowManager]::SW_SHOWMAXIMIZED) | Out-Null
            [WindowManager]::SetForegroundWindow($hwnd) | Out-Null
            return $true
        } catch {
            return $false
        }
    }

    Log "Rilevamento monitor..."
    $screens = [System.Windows.Forms.Screen]::AllScreens
    Log "Monitor totali: $($screens.Count)"

    # Helper to start process
    function Start-Viewer($exePath, $args) {
        try {
            if ($args -and $args.Count -gt 0) {
                Log "   Argomenti: $($args -join ' | ')"
                return Start-Process -FilePath $exePath -ArgumentList $args -PassThru -WindowStyle Normal
            } else {
                return Start-Process -FilePath $exePath -PassThru -WindowStyle Normal
            }
        } catch {
            try { Log ("ERRORE avvio processo " + $exePath + ": " + $_.ToString()) } catch { }
            return $null
        }
    }

    function Open-With-Chrome($chromePath, $filePath, $x, $y, $w, $h) {
        # Usa l'endpoint serve-pdf del server unificato per aprire il PDF
        # Il viewer Chrome apre il PDF via HTTP, così il file viene servito correttamente.
        $fileUrl = 'http://localhost:5500/api/serve-pdf?file=' + [System.Net.WebUtility]::UrlEncode($FilePath)
        $args = @('--new-window', $fileUrl, '--disable-infobars', '--disable-session-crashed-bubble', '--disable-extensions', '--disable-background-networking')
        if ($null -ne $x -and $null -ne $y -and $null -ne $w -and $null -ne $h) {
            $args += "--window-position=$x,$y"
            $args += "--window-size=$w,$h"
        }
        return Start-Viewer $chromePath $args
    }

    function Find-ChromePath() {
        $chrome = Get-Command 'chrome.exe' -ErrorAction SilentlyContinue
        if ($chrome) { return $chrome.Source }

        $candidates = @(
            'C:\Program Files\Google\Chrome\Application\chrome.exe',
            'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
        )
        foreach ($path in $candidates) {
            if (Test-Path $path) { return $path }
        }
        return $null
    }

    function Find-AcrobatPath() {
        $candidates = @(
            'C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe',
            'C:\Program Files (x86)\Adobe\Acrobat Reader DC\Reader\AcroRd32.exe',
            'C:\Program Files\Adobe\Acrobat Reader DC\Reader\AcroRd32.exe'
        )
        foreach ($path in $candidates) {
            if (Test-Path $path) { return $path }
        }
        return $null
    }

    if ($screens.Count -lt 2) {
        Log "Un solo monitor - apertura normale"
        $proc = $null
        $chromePath = Find-ChromePath
        $acrobatPath = Find-AcrobatPath

        if ($Viewer -eq 'chrome') {
            if ($chromePath) {
                Log "Avvio Chrome in fullscreen (single monitor)"
                $proc = Open-With-Chrome $chromePath $FilePath $null $null $null $null
            } else {
                Log "Chrome non trovato, fallback a viewer di default"
                $proc = Start-Viewer $FilePath
            }
        } elseif ($Viewer -eq 'adobe') {
            if ($AdobePath -and (Test-Path $AdobePath)) {
                Log "Avvio Acrobat (single) da: $AdobePath"
                $proc = Start-Viewer $AdobePath @($FilePath)
            } elseif ($acrobatPath) {
                Log "Avvio Acrobat (single) da candidato: $acrobatPath"
                $proc = Start-Viewer $acrobatPath @($FilePath)
            } elseif ($chromePath) {
                Log "Acrobat non trovato, fallback Chrome in fullscreen"
                $proc = Open-With-Chrome $chromePath $FilePath $null $null $null $null
            } else {
                Log "Nessun viewer specifico trovato, avvio viewer di default"
                $proc = Start-Viewer $FilePath
            }
        } else {
            if ($chromePath) {
                Log "Avvio Chrome in fullscreen (auto)"
                $proc = Open-With-Chrome $chromePath $FilePath $null $null $null $null
            } elseif ($acrobatPath) {
                Log "Avvio Acrobat in fullscreen (auto)"
                $proc = Start-Viewer $acrobatPath @($FilePath)
            } else {
                Log "Nessun viewer specifico trovato, avvio viewer di default"
                $proc = Start-Viewer $FilePath
            }
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
        $chromePath = Find-ChromePath
        $acrobatPath = Find-AcrobatPath

        if ($Viewer -eq 'chrome') {
            if ($chromePath) {
                Log "Avvio Chrome in fullscreen sul monitor secondario"
                $proc = Open-With-Chrome $chromePath $FilePath $x $y $w $h
            } elseif ($acrobatPath) {
                Log "Chrome non trovato, fallback Acrobat sul monitor secondario"
                $proc = Start-Viewer $acrobatPath @($FilePath)
            } else {
                Log "Nessun viewer specifico trovato, avvio viewer di default"
                $proc = Start-Viewer $FilePath
            }
        } elseif ($Viewer -eq 'adobe') {
            if ($AdobePath -and (Test-Path $AdobePath)) {
                Log "Avvio Acrobat da percorso custom: $AdobePath"
                $proc = Start-Viewer $AdobePath @($FilePath)
            } elseif ($acrobatPath) {
                Log "Avvio Acrobat da candidato: $acrobatPath"
                $proc = Start-Viewer $acrobatPath @($FilePath)
            } elseif ($chromePath) {
                Log "Acrobat non trovato, fallback Chrome in fullscreen"
                $proc = Open-With-Chrome $chromePath $FilePath $x $y $w $h
            } else {
                Log "Nessun viewer specifico trovato, avvio viewer di default"
                $proc = Start-Viewer $FilePath
            }
        } else {
            if ($chromePath) {
                Log "Avvio Chrome in fullscreen sul monitor secondario (auto)"
                $proc = Open-With-Chrome $chromePath $FilePath $x $y $w $h
            } elseif ($acrobatPath) {
                Log "Avvio Acrobat sul monitor secondario (auto)"
                $proc = Start-Viewer $acrobatPath @($FilePath)
            } else {
                Log "Nessun viewer specifico trovato, avvio viewer di default"
                $proc = Start-Viewer $FilePath
            }
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

                if ($i -eq 100 -and -not $found) {
                    Log "   Non trovato main window: cerco finestre del PID e dei processi figli $procId"
                    $handles = Get-WindowHandlesForPidTree $procId
                    if ($handles.Count -gt 0) {
                        $pdfWindow = $handles[0]
                        Log "   Trovati handle con PID (inclusi figli): $($handles.Count)"
                        $found = $true
                        break
                    }
                }

                if ($i % 20 -eq 0 -and $i -gt 0) {
                    Log "   [Attesa $($i*100)ms] MainWindowHandle: $(if ($null -eq $hwnd) { 'null' } else { $hwnd.ToInt64() })"
                }
            }

            if ($found -and $null -ne $pdfWindow -and $pdfWindow -ne [IntPtr]::Zero) {
                Log "✅ Finestra PDF trovata: $($pdfWindow.ToInt64())"
                Log "Esecuzione spostamento e fullscreen sul monitor 2..."
                if (Move-And-MaximizeWindow $pdfWindow $x $y $w $h) {
                    Log "✅ Finestra spostata e massimizzata sul monitor secondario"
                } else {
                    Log "⚠️  Move-And-MaximizeWindow non ha funzionato, provo comunque SetWindowPos e ShowWindow"
                    try {
                        $flags = [WindowManager]::SWP_SHOWWINDOW -bor [WindowManager]::SWP_NOZORDER
                        [WindowManager]::SetWindowPos($pdfWindow, [IntPtr]::Zero, $x, $y, $w, $h, $flags) | Out-Null
                        [WindowManager]::ShowWindow($pdfWindow, [WindowManager]::SW_SHOWMAXIMIZED) | Out-Null
                        Log "✅ Tentativo alternativo di spostamento/masgimizzazione eseguito"
                    } catch {
                        Log "❌ Errore alternativo spostamento/masgimizzazione: $_"
                    }
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
