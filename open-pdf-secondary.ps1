param([string]$FilePath)

# Logging
$logFile = "c:\VSC_Live_Server\pdf-open.log"

function Log([string]$msg) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
    $fullMsg = "[$timestamp] $msg"
    Write-Host $fullMsg
    Add-Content -Path $logFile -Value $fullMsg -Encoding UTF8 2>$null
}

try {
    Log "=== INIZIO Apertura PDF: $FilePath ==="
    
    # Aggiungi tipo Windows API per trovare finestre
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public class WindowManager {
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
    
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    
    public const uint SWP_NOSIZE = 1;
    public const uint SWP_NOZORDER = 4;
    public const uint SWP_SHOWWINDOW = 64;
}
"@ -ErrorAction Stop
    
    Add-Type -AssemblyName System.Windows.Forms | Out-Null
    
    Log "Rilevamento monitor..."
    
    $screens = [System.Windows.Forms.Screen]::AllScreens
    Log "Monitor totali: $($screens.Count)"
    
    if ($screens.Count -lt 2) {
        Log "Un solo monitor - apertura normale"
        Start-Process $FilePath
        Log "Processo avviato"
    } else {
        Log "Monitor secondario rilevato - apertura su monitor 2..."
        $secondary = $screens[1]
        $x = $secondary.WorkingArea.X
        $y = $secondary.WorkingArea.Y
        $w = $secondary.WorkingArea.Width
        $h = $secondary.WorkingArea.Height
        Log "   Monitor 2: X=$x Y=$y W=$w H=$h"
        
        Log "Apertura PDF..."
        $proc = Start-Process $FilePath -PassThru
        $procId = $proc.Id
        Log "   Processo avviato con PID: $procId"
        
        # Memorizza la finestra precedente
        $prevWindow = [WindowManager]::GetForegroundWindow()
        Log "Finestra precedente: $prevWindow"
        
        # Attesa fino a 15 secondi (150 iterazioni da 100ms)
        Log "Attesa finestra (15s max)..."
        $pdfWindow = $null
        $found = $false
        
        for ($i = 0; $i -lt 150; $i++) {
            Start-Sleep -Milliseconds 100
            $proc.Refresh()
            
            $hwnd = $proc.MainWindowHandle
            
            # Controlla MainWindowHandle  
            if ($null -ne $hwnd -and $hwnd -ne [IntPtr]::Zero) {
                Log "MainWindowHandle trovato dopo $($i*100)ms"
                $pdfWindow = $hwnd
                $found = $true
                break
            }
            
            # Se MainWindowHandle non funziona, controlla la finestra foreground
            $fg = [WindowManager]::GetForegroundWindow()
            if ($fg -ne $prevWindow -and $fg -ne [IntPtr]::Zero) {
                Log "Finestra foreground cambiata dopo $($i*100)ms"
                $pdfWindow = $fg
                $found = $true
                break
            }
            
            # Logging ogni 20 iterazioni
            if ($i % 20 -eq 0 -and $i -gt 0) {
                Log "   [Attesa $($i*100)ms] MainWindowHandle: null, ForegroundWindow: $fg"
            }
        }
        
        if ($found -and $null -ne $pdfWindow -and $pdfWindow -ne [IntPtr]::Zero) {
            Log "✅ Finestra PDF trovata"
            Log "Esecuzione SetWindowPos per spostamento al monitor 2..."
            
            $flags = [WindowManager]::SWP_SHOWWINDOW -bor [WindowManager]::SWP_NOZORDER
            try {
                $result = [WindowManager]::SetWindowPos($pdfWindow, [IntPtr]::Zero, $x, $y, $w, $h, $flags)
                
                if ($result) {
                    Log "✅ SetWindowPos SUCCESS - Finestra spostata al monitor secondario"
                } else {
                    Log "⚠️  SetWindowPos riorna FALSE"
                }
            } catch {
                Log "❌ ERRORE SetWindowPos: $_"
            }
        } else {
            Log "⚠️  Finestra PDF non trovata dopo 15 secondi"
            Log "   Causa probabile: lettore PDF moderno (Edge/Chrome) che non espone window handle"
            Log "   SOLUZIONE: Sposta manualmente il PDF al monitor secondario"
        }
    }
    
    Log "=== FINE Apertura PDF ==="
} catch {
    Log "❌ ERRORE: $_"
    Log "Exception: $($_.Exception.Message)"
}
