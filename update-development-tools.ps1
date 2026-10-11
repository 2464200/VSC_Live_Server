param(
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$script:Failures = [System.Collections.Generic.List[string]]::new()
$repositoryRoot = $PSScriptRoot

function Write-Section {
    param([string]$Title)

    Write-Host "`n=== $Title ===" -ForegroundColor Cyan
}

function Add-Failure {
    param(
        [string]$Name,
        [string]$Message
    )

    $script:Failures.Add("$Name`: $Message")
    Write-Host "ERRORE - $Name`: $Message" -ForegroundColor Red
}

function Test-CommandAvailable {
    param([string]$Name)

    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Refresh-ProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machinePath;$userPath"
}

function Invoke-WingetPackage {
    param(
        [string]$Name,
        [string]$Id
    )

    Write-Host "`n$Name ($Id)" -ForegroundColor Yellow
    $listOutput = & winget list --id $Id --exact --accept-source-agreements --disable-interactivity 2>&1
    $listExitCode = $LASTEXITCODE
    if ($listExitCode -ne 0 -and $listExitCode -ne -1978335212) {
        throw "winget list non riuscito (codice $LASTEXITCODE)."
    }

    $packagePattern = [regex]::Escape($Id)
    $isInstalled = $listExitCode -eq 0 -and (($listOutput | Out-String) -match $packagePattern)

    if ($CheckOnly) {
        if (-not $isInstalled) {
            Write-Host 'Non installato.' -ForegroundColor Yellow
            Add-Failure -Name $Name -Message 'Software richiesto non installato.'
            return
        }

        $upgradeOutput = & winget list --id $Id --exact --upgrade-available --accept-source-agreements --disable-interactivity 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Verifica aggiornamenti non riuscita (codice $LASTEXITCODE)."
        }

        if (($upgradeOutput | Out-String) -match $packagePattern) {
            Write-Host 'Aggiornamento disponibile.' -ForegroundColor Yellow
        } else {
            Write-Host 'Installato e aggiornato.' -ForegroundColor Green
        }

        return
    }

    if ($isInstalled) {
        Write-Host 'Verifica/aggiornamento...' -ForegroundColor Yellow
        & winget upgrade --id $Id --exact --accept-source-agreements --accept-package-agreements --disable-interactivity
        if ($LASTEXITCODE -ne 0) {
            throw "winget upgrade non riuscito (codice $LASTEXITCODE)."
        }

        Write-Host 'Aggiornamento completato o gia aggiornato.' -ForegroundColor Green
        return
    }

    Write-Host 'Non installato: installazione in corso...' -ForegroundColor Yellow
    & winget install --id $Id --exact --accept-source-agreements --accept-package-agreements --disable-interactivity
    if ($LASTEXITCODE -ne 0) {
        throw "winget install non riuscito (codice $LASTEXITCODE)."
    }

    Write-Host 'Installato.' -ForegroundColor Green
}

function Invoke-NpmInstall {
    param([string]$Directory)

    Push-Location $Directory
    try {
        Write-Host "`nRipristino dipendenze npm: $Directory" -ForegroundColor Yellow
        & npm.cmd install
        if ($LASTEXITCODE -ne 0) {
            throw "npm install non riuscito (codice $LASTEXITCODE)."
        }
        Write-Host 'Dipendenze npm installate secondo package-lock.json.' -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

function Invoke-PythonSetup {
    $venvPython = Join-Path $repositoryRoot '.venv\Scripts\python.exe'
    if (-not (Test-Path $venvPython)) {
        Write-Host 'Creazione dell ambiente virtuale Python .venv...' -ForegroundColor Yellow
        & py -3 -m venv (Join-Path $repositoryRoot '.venv')
        if ($LASTEXITCODE -ne 0) {
            throw "Creazione di .venv non riuscita (codice $LASTEXITCODE)."
        }
    }

    $venvPython = Join-Path $repositoryRoot '.venv\Scripts\python.exe'
    if (-not (Test-Path $venvPython)) {
        throw 'Python non ha creato .venv\Scripts\python.exe.'
    }

    Write-Host 'Aggiornamento pip e dipendenze Python del repository...' -ForegroundColor Yellow
    & $venvPython -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) {
        throw "Aggiornamento pip non riuscito (codice $LASTEXITCODE)."
    }

    $requirements = @(
        (Join-Path $repositoryRoot 'requirements-dev.txt'),
        (Join-Path $repositoryRoot 'LedDisplay\requirements.txt')
    )
    foreach ($requirementsFile in $requirements) {
        if (-not (Test-Path $requirementsFile)) {
            throw "File requisiti non trovato: $requirementsFile"
        }

        & $venvPython -m pip install --upgrade --requirement $requirementsFile
        if ($LASTEXITCODE -ne 0) {
            throw "Installazione requisiti non riuscita: $requirementsFile (codice $LASTEXITCODE)."
        }
    }

    Write-Host 'Dipendenze Python installate nell ambiente .venv.' -ForegroundColor Green
}

function Get-VSCodeCli {
    $command = Get-Command code -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\bin\code.cmd'),
        (Join-Path $env:ProgramFiles 'Microsoft VS Code\bin\code.cmd')
    )
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    return $null
}

Write-Host 'Aggiornamento degli strumenti e delle dipendenze necessari al repository' -ForegroundColor Cyan
if ($CheckOnly) {
    Write-Host 'Modalita controllo: non verra installato o aggiornato alcun componente.' -ForegroundColor DarkYellow
}

Write-Section 'Software Windows richiesto dal progetto'
if (-not (Test-CommandAvailable 'winget')) {
    Add-Failure -Name 'winget' -Message 'Non disponibile: impossibile verificare, installare o aggiornare il software Windows.'
} else {
    $packages = @(
        @{ Name = 'Node.js LTS'; Id = 'OpenJS.NodeJS.LTS' },
        @{ Name = 'Python 3.14'; Id = 'Python.Python.3.14' },
        @{ Name = 'Git'; Id = 'Git.Git' },
        @{ Name = 'GitHub Desktop'; Id = 'GitHub.GitHubDesktop' },
        @{ Name = 'AutoHotkey v2'; Id = 'AutoHotkey.AutoHotkey' },
        @{ Name = 'Visual Studio Code'; Id = 'Microsoft.VisualStudioCode' },
        @{ Name = 'Google Chrome'; Id = 'Google.Chrome' },
        @{ Name = 'VLC'; Id = 'VideoLAN.VLC' },
        @{ Name = 'ImageMagick (generatore LedDisplay)'; Id = 'ImageMagick.ImageMagick' }
    )

    foreach ($package in $packages) {
        try {
            Invoke-WingetPackage -Name $package.Name -Id $package.Id
        } catch {
            Add-Failure -Name $package.Name -Message $_.Exception.Message
        }
    }
}

Refresh-ProcessPath

Write-Section 'Versioni degli strumenti'
foreach ($tool in @(
    @{ Name = 'Node.js'; Command = 'node'; Arguments = @('--version') },
    @{ Name = 'npm'; Command = 'npm.cmd'; Arguments = @('--version') },
    @{ Name = 'Python launcher'; Command = 'py'; Arguments = @('--version') },
    @{ Name = 'Git'; Command = 'git'; Arguments = @('--version') }
)) {
    if (Test-CommandAvailable $tool.Command) {
        $toolArguments = $tool.Arguments
        $version = & $tool.Command @toolArguments 2>&1 | Select-Object -First 1
        Write-Host ('{0}: {1}' -f $tool.Name, $version)
    } else {
        Add-Failure -Name $tool.Name -Message 'Non installato o non presente nel PATH.'
    }
}

Write-Section 'Dipendenze npm'
if (-not (Test-CommandAvailable 'npm.cmd')) {
    Add-Failure -Name 'npm' -Message 'Non disponibile: impossibile installare le dipendenze npm.'
} elseif ($CheckOnly) {
    foreach ($directory in @($repositoryRoot, (Join-Path $repositoryRoot 'Bordero\server'))) {
        Push-Location $directory
        try {
            & npm.cmd ls --depth=0
            if ($LASTEXITCODE -ne 0) {
                Add-Failure -Name "Dipendenze npm in $directory" -Message 'Installazione incompleta o non conforme ai manifest.'
            }
        } finally {
            Pop-Location
        }
    }
} else {
    foreach ($directory in @($repositoryRoot, (Join-Path $repositoryRoot 'Bordero\server'))) {
        try {
            Invoke-NpmInstall -Directory $directory
        } catch {
            Add-Failure -Name "Dipendenze npm in $directory" -Message $_.Exception.Message
        }
    }
}

Write-Section 'Dipendenze Python'
$venvPython = Join-Path $repositoryRoot '.venv\Scripts\python.exe'
if ($CheckOnly) {
    if (-not (Test-Path $venvPython)) {
        Add-Failure -Name 'Ambiente Python' -Message 'Virtual environment .venv non trovato.'
    } else {
        & $venvPython -m pip check
        if ($LASTEXITCODE -ne 0) {
            Add-Failure -Name 'Dipendenze Python' -Message 'pip check ha rilevato dipendenze mancanti o incompatibili.'
        }

        $installedPythonPackages = & $venvPython -m pip list --format=json
        if ($LASTEXITCODE -ne 0) {
            Add-Failure -Name 'Dipendenze Python' -Message 'Impossibile leggere i pacchetti installati in .venv.'
        } else {
            $installedPythonNames = @($installedPythonPackages | ConvertFrom-Json | ForEach-Object { $_.name.ToLowerInvariant() })
            foreach ($packageName in @('openpyxl', 'flask', 'flask-cors', 'pillow')) {
                if ($installedPythonNames -notcontains $packageName) {
                    Add-Failure -Name $packageName -Message 'Pacchetto Python richiesto non installato.'
                }
            }
        }
    }
} elseif (-not (Test-CommandAvailable 'py')) {
    Add-Failure -Name 'Python' -Message 'Il launcher py non e disponibile: impossibile creare o aggiornare .venv.'
} else {
    try {
        Invoke-PythonSetup
    } catch {
        Add-Failure -Name 'Dipendenze Python' -Message $_.Exception.Message
    }
}

Write-Section 'Estensioni VS Code necessarie'
$vscodeExtensions = @(
    'ms-python.python',
    'ms-python.vscode-pylance',
    'ms-python.vscode-python-envs',
    'ms-python.debugpy',
    'ms-vscode.powershell',
    'ritwickdey.liveserver',
    'mechatroner.rainbow-csv',
    'cweijan.vscode-office',
    'mark-wiemer.vscode-autohotkey-plus-plus',
    'github.vscode-github-actions',
    'redhat.vscode-yaml'
)
$codeCli = Get-VSCodeCli
if (-not $codeCli) {
    Add-Failure -Name 'Estensioni VS Code' -Message 'CLI code non disponibile: impossibile verificare o aggiornare le estensioni.'
} else {
    $installedExtensions = @(& $codeCli --list-extensions 2>&1)
    if ($LASTEXITCODE -ne 0) {
        Add-Failure -Name 'Estensioni VS Code' -Message 'Impossibile leggere l elenco delle estensioni installate.'
    } elseif ($CheckOnly) {
        foreach ($extension in $vscodeExtensions) {
            if ($installedExtensions -contains $extension) {
                Write-Host "$extension`: installata" -ForegroundColor Green
            } else {
                Write-Host "$extension`: non installata" -ForegroundColor Yellow
                Add-Failure -Name $extension -Message 'Estensione richiesta non installata.'
            }
        }
    } else {
        foreach ($extension in $vscodeExtensions) {
            Write-Host "Installazione/aggiornamento $extension..." -ForegroundColor Yellow
            & $codeCli --install-extension $extension
            if ($LASTEXITCODE -ne 0) {
                Add-Failure -Name $extension -Message "Installazione/aggiornamento non riuscito (codice $LASTEXITCODE)."
            }
        }
    }
}

Write-Section 'Prerequisiti con licenza o installazione manuale'
$excelProgId = 'Registry::HKEY_CLASSES_ROOT\Excel.Application\CLSID'
if (Test-Path $excelProgId) {
    Write-Host 'Microsoft Excel COM registrato.' -ForegroundColor Green
} else {
    Write-Warning 'Microsoft Excel non risulta registrato come componente COM. Gli script VBA/Excel richiedono Office/Excel con licenza; questo task non installa software Office con licenza.'
}

if ($script:Failures.Count -gt 0) {
    Write-Section 'Riepilogo errori'
    foreach ($failure in $script:Failures) {
        Write-Host "- $failure" -ForegroundColor Red
    }
    exit 1
}

Write-Host "`nControllo/aggiornamento completato." -ForegroundColor Green
