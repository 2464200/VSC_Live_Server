param([string]$FilePath)

try {
    Add-Type -AssemblyName System.Windows.Forms | Out-Null
    
    # Aggiunta tipo per Windows API
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class Mover {
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    
    public const uint SWP_NOSIZE = 1;
    public const uint SWP_NOZORDER = 4;
    public const uint SWP_SHOWWINDOW = 64;
}
"@ -ErrorAction Stop
    
    Write-Host " Apertura: $FilePath"
    
    $screens = [System.Windows.Forms.Screen]::AllScreens
    Write-Host " Monitor: $($screens.Count)"
    
    if ($screens.Count -lt 2) {
        Write-Host " Un solo monitor - apertura normale"
        Start-Process $FilePath
    } else {
        Write-Host " Monitor secondario rilevato"
        $secondary = $screens[1]
        $x = $secondary.WorkingArea.X
        $y = $secondary.WorkingArea.Y
        $w = $secondary.WorkingArea.Width
        $h = $secondary.WorkingArea.Height
        Write-Host "   Monitor 2: X=$x Y=$y W=$w H=$h"
        
        Write-Host " Apertura PDF..."
        $proc = Start-Process $FilePath -PassThru
        Write-Host "   PID: $($proc.Id)"
        
        Write-Host " Attesa finestra (8s max)..."
        $found = $false
        for ($i = 0; $i -lt 80; $i++) {
            Start-Sleep -Milliseconds 100
            $proc.Refresh()
            if ($proc.MainWindowHandle -ne [IntPtr]::Zero) {
                Write-Host " Finestra trovata (hwnd: $($proc.MainWindowHandle))"
                Write-Host " Sposto finestra al monitor secondario..."
                
                $flags = [Mover]::SWP_SHOWWINDOW -bor [Mover]::SWP_NOZORDER
                $result = [Mover]::SetWindowPos($proc.MainWindowHandle, [IntPtr]::Zero, $x, $y, $w, $h, $flags)
                Write-Host "   SetWindowPos result: $result"
                
                Start-Sleep -Milliseconds 300
                $found = $true
                break
            }
        }
        
        if (-not $found) {
            Write-Host " Finestra non trovata ma PDF è aperto"
        } else {
            Write-Host " Finestra spostata al monitor secondario"
        }
    }
    
    Write-Host " Operazione completata"
} catch {
    Write-Host " ERRORE: $_"
    Write-Host $_.Exception
}
