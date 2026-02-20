param([string]$FilePath)

# Script per aprire PDF sul monitor secondario

try {
    # Carica assembly necessari
    Add-Type -AssemblyName System.Windows.Forms | Out-Null
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;

    public class WindowHelper {
        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr FindWindowByTitle(string lpClassName, string lpWindowName);
        
        [DllImport("user32.dll")]
        public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
        
        [DllImport("user32.dll")]
        public static extern bool IsWindow(IntPtr hWnd);

        public const uint SWP_NOSIZE = 0x0001;
        public const uint SWP_NOZORDER = 0x0004;
        public const uint SWP_SHOWWINDOW = 0x0040;
    }
"@ | Out-Null

    Write-Host "📖 Apertura PDF: $FilePath"
    
    # Rileva i monitor disponibili
    $screens = [System.Windows.Forms.Screen]::AllScreens
    Write-Host "📊 Monitor disponibili: $($screens.Count)"
    
    if ($screens.Count -lt 2) {
        Write-Host "⚠️ Un solo monitor rilevato - apertura normale"
        Start-Process $FilePath
    } else {
        Write-Host "✅ Monitor secondario rilevato"
        
        # Dati monitor secondario
        $secondary = $screens[1]
        $secondaryX = $secondary.WorkingArea.X
        $secondaryY = $secondary.WorkingArea.Y
        $secondaryWidth = $secondary.WorkingArea.Width
        $secondaryHeight = $secondary.WorkingArea.Height
        
        Write-Host "   Monitor 2 - X:$secondaryX Y:$secondaryY W:$secondaryWidth H:$secondaryHeight"
        
        # Apri il file
        $proc = Start-Process $FilePath -PassThru
        Write-Host "🚀 Processo avviato (PID: $($proc.Id))"
        
        # Attendi che la finestra si apra (max 5 secondi)
        $maxWait = 50  # 50 * 100ms = 5 secondi
        $waited = 0
        $windowFound = $false
        
        while ($waited -lt $maxWait) {
            Start-Sleep -Milliseconds 100
            $waited++
            
            # Cerca la finestra per nome del file o titolo generico
            $wnd = Get-Process | Where-Object { $_.Id -eq $proc.Id } | ForEach-Object { $_.MainWindowHandle }
            
            if ($wnd -and $wnd -ne [IntPtr]::Zero) {
                Write-Host "   ✅ Finestra trovata! Sposto al monitor secondario..."
                
                # Sposta la finestra al monitor secondario
                $flags = [WindowHelper]::SWP_NOZORDER -bor [WindowHelper]::SWP_SHOWWINDOW
                $result = [WindowHelper]::SetWindowPos($wnd, [IntPtr]::Zero, $secondaryX, $secondaryY, $secondaryWidth, $secondaryHeight, $flags)
                
                if ($result) {
                    Write-Host "   ✅✅ Finestra spostata con successo!"
                } else {
                    Write-Host "   ⚠️ Errore nello spostamento della finestra"
                }
                
                $windowFound = $true
                break
            }
        }
        
        if (-not $windowFound) {
            Write-Host "   ⚠️ Finestra non trovata entro il timeout (ma file è aperto)"
        }
    }
    
    Write-Host "✅ Operazione completata"
} catch {
    Write-Host "❌ ERRORE: $_"
    exit 1
}
