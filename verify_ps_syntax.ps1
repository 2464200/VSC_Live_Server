$scripts = @('startup.ps1','autostart.ps1','open_display_on_secondary.ps1','open_bordero_on_primary.ps1','open_all_html_on_secondary.ps1')
foreach ($script in $scripts) {
    $tokens = $null
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($script, [ref]$tokens, [ref]$errors)
    if ($errors) {
        Write-Host "ERROR in $script" -ForegroundColor Red
        $errors | ForEach-Object { Write-Host $_.Message }
        exit 1
    }
    Write-Host "OK $script"
}
