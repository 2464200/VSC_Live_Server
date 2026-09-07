param(
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Continue'

function Test-CommandAvailable {
    param([string]$Name)

    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Write-Section {
    param([string]$Title)

    Write-Host "`n=== $Title ===" -ForegroundColor Cyan
}

function Get-CommandVersion {
    param(
        [string]$Name,
        [string[]]$Arguments = @('--version')
    )

    if (-not (Test-CommandAvailable $Name)) {
        return 'non installato o non presente nel PATH'
    }

    try {
        $version = & $Name @Arguments 2>$null | Select-Object -First 1
        if ([string]::IsNullOrWhiteSpace($version)) {
            return 'versione non rilevata'
        }

        return $version.Trim()
    } catch {
        return 'versione non rilevata'
    }
}

function Update-WingetPackage {
    param(
        [string]$Name,
        [string]$Id
    )

    Write-Host "`n$Name ($Id)" -ForegroundColor Yellow

    $checkOutput = & winget upgrade --id $Id --exact --accept-source-agreements 2>&1
    $checkText = $checkOutput | Out-String

    if ($checkText -match 'No installed package found|Nessun pacchetto installato trovato') {
        Write-Host 'Non installato: nessuna installazione eseguita.' -ForegroundColor DarkGray
        return
    }

    if ($checkText -match 'No available upgrade found|Nessun aggiornamento disponibile') {
        Write-Host 'Gia aggiornato.' -ForegroundColor Green
        return
    }

    if ($CheckOnly) {
        Write-Host 'Aggiornamento disponibile.' -ForegroundColor Yellow
        return
    }

    Write-Host 'Aggiornamento in corso...' -ForegroundColor Yellow
    & winget upgrade --id $Id --exact --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -eq 0) {
        Write-Host 'Aggiornato.' -ForegroundColor Green
    } else {
        Write-Warning "Aggiornamento non completato (codice $LASTEXITCODE)."
    }
}

Write-Host 'Controllo aggiornamenti degli strumenti di sviluppo del progetto' -ForegroundColor Cyan
if ($CheckOnly) {
    Write-Host 'Modalita controllo: non verra modificato alcun software.' -ForegroundColor DarkYellow
}

Write-Section 'Versioni rilevate'
$versions = @(
    @{ Name = 'Node.js'; Command = 'node'; Arguments = @('--version') },
    @{ Name = 'npm'; Command = 'npm'; Arguments = @('--version') },
    @{ Name = 'Python'; Command = 'py'; Arguments = @('--version') },
    @{ Name = 'Git'; Command = 'git'; Arguments = @('--version') },
    @{ Name = 'Firebase CLI'; Command = 'firebase'; Arguments = @('--version') },
    @{ Name = 'AutoHotkey'; Command = 'AutoHotkey'; Arguments = @('/ErrorStdOut', '*') },
    @{ Name = 'VS Code'; Command = 'code'; Arguments = @('--version') }
)

foreach ($tool in $versions) {
    $version = Get-CommandVersion -Name $tool.Command -Arguments $tool.Arguments
    Write-Host ('{0}: {1}' -f $tool.Name, $version)
}

if (-not (Test-CommandAvailable 'winget')) {
    Write-Warning 'winget non e disponibile. Impossibile verificare o aggiornare i programmi Windows.'
} else {
    Write-Section 'Programmi Windows'
    $packages = @(
        @{ Name = 'Node.js LTS'; Id = 'OpenJS.NodeJS.LTS' },
        @{ Name = 'Python 3.14'; Id = 'Python.Python.3.14' },
        @{ Name = 'Python 3.13'; Id = 'Python.Python.3.13' },
        @{ Name = 'Python 3.12'; Id = 'Python.Python.3.12' },
        @{ Name = 'Git'; Id = 'Git.Git' },
        @{ Name = 'GitHub Desktop'; Id = 'GitHub.GitHubDesktop' },
        @{ Name = 'AutoHotkey'; Id = 'AutoHotkey.AutoHotkey' },
        @{ Name = 'Visual Studio Code'; Id = 'Microsoft.VisualStudioCode' },
        @{ Name = 'Google Chrome'; Id = 'Google.Chrome' },
        @{ Name = 'VLC'; Id = 'VideoLAN.VLC' }
    )

    foreach ($package in $packages) {
        Update-WingetPackage -Name $package.Name -Id $package.Id
    }
}

Write-Section 'Firebase CLI'
if (-not (Test-CommandAvailable 'npm')) {
    Write-Warning 'npm non e disponibile: Firebase CLI non puo essere verificata.'
} elseif (-not (Test-CommandAvailable 'firebase')) {
    Write-Host 'Firebase CLI non installata globalmente: nessuna installazione eseguita.' -ForegroundColor DarkGray
} else {
    $outdatedJson = & npm outdated --global firebase-tools --json 2>$null
    if ($outdatedJson) {
        try {
            $outdated = $outdatedJson | ConvertFrom-Json
            if ($null -ne $outdated.'firebase-tools') {
                if ($CheckOnly) {
                    Write-Host 'Aggiornamento Firebase CLI disponibile.' -ForegroundColor Yellow
                } else {
                    Write-Host 'Aggiornamento Firebase CLI in corso...' -ForegroundColor Yellow
                    & npm install --global firebase-tools@latest
                }
            } else {
                Write-Host 'Firebase CLI gia aggiornata.' -ForegroundColor Green
            }
        } catch {
            Write-Warning 'Non e stato possibile interpretare il controllo npm per Firebase CLI.'
        }
    } else {
        Write-Host 'Firebase CLI gia aggiornata.' -ForegroundColor Green
    }
}

Write-Host "`nControllo completato." -ForegroundColor Cyan