Add-Type -AssemblyName System.Windows.Forms

$screens = [System.Windows.Forms.Screen]::AllScreens
$secondary = $screens | Where-Object { -not $_.Primary } | Select-Object -First 1
if (-not $secondary) {
    $secondary = [System.Windows.Forms.Screen]::PrimaryScreen
}

$bounds = $secondary.Bounds
$url = 'http://localhost:5500/Bordero/pages/display.html'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $chrome)) {
    $chrome = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
}

if (Test-Path $chrome) {
    $args = @('--new-window', '--kiosk', "--window-position=$($bounds.X),$($bounds.Y)", "--window-size=$($bounds.Width),$($bounds.Height)", $url)
    $proc = Start-Process -FilePath $chrome -ArgumentList $args -PassThru
    Write-Host "OPENED_PID=$($proc.Id)"
    Write-Host "TARGET=$url"
    Write-Host "SCREEN=$($bounds.X),$($bounds.Y) $($bounds.Width)x$($bounds.Height)"
} else {
    Start-Process -FilePath $url
    Write-Host "CHROME_NOT_FOUND=$url"
}
