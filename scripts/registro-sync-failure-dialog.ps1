param([Parameter(Mandatory = $true)][string]$ReportPath, [ValidateSet('Continue', 'Abort', 'Close')][string]$SelfTestChoice)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$report = Get-Content -LiteralPath $ReportPath -Raw | ConvertFrom-Json
if ($PSBoundParameters.ContainsKey('SelfTestChoice')) {
    if ($SelfTestChoice -eq 'Continue' -and [bool]$report.previousCsvAvailable) { exit 0 }
    exit 1
}
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Aggiornamento Registro non riuscito'
$form.StartPosition = 'CenterScreen'
$form.Size = New-Object System.Drawing.Size(760, 590)
$form.MinimumSize = New-Object System.Drawing.Size(620, 450)
$form.TopMost = $true

$title = New-Object System.Windows.Forms.Label
$title.Text = "Task: $($report.task)"
$title.Font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
$title.SetBounds(18, 15, 710, 28)
$form.Controls.Add($title)

$summary = New-Object System.Windows.Forms.TextBox
$summary.Multiline = $true
$summary.ReadOnly = $true
$summary.ScrollBars = 'Vertical'
$summary.WordWrap = $true
$summary.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$summary.SetBounds(18, 52, 710, 405)
$summary.Anchor = 'Top,Bottom,Left,Right'
$lines = @("Causa: $($report.cause)", "Verifica: $($report.diagnostics.status)", "CSV precedenti disponibili e validi: $(if ($report.previousCsvAvailable) { 'sì' } else { 'no' })", '')
foreach ($difference in @($report.diagnostics.differences | Select-Object -First 12)) { $lines += "• $difference" }
if (@($report.diagnostics.differences).Count -gt 12) { $lines += "• Altre differenze nel dettaglio diagnostico." }
foreach ($change in @($report.diagnostics.rowChanges | Select-Object -First 6)) { $lines += "• $($change.filename): nuovi $($change.added), modificati $($change.changed), rimossi $($change.removed) record." }
foreach ($item in @($report.diagnostics.partial | Select-Object -First 8)) { $lines += "• $item" }
$lines += "", "Dettaglio: $ReportPath", $report.note
$summary.Text = $lines -join [Environment]::NewLine
$form.Controls.Add($summary)

$abort = New-Object System.Windows.Forms.Button
$abort.Text = 'Interrompi aggiornamento'
$abort.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$abort.SetBounds(386, 480, 165, 34)
$abort.Anchor = 'Bottom,Right'
$form.Controls.Add($abort)
$continue = New-Object System.Windows.Forms.Button
$continue.Text = 'Continua con i CSV precedenti'
$continue.DialogResult = [System.Windows.Forms.DialogResult]::OK
$continue.Enabled = [bool]$report.previousCsvAvailable
$continue.SetBounds(556, 480, 172, 34)
$continue.Anchor = 'Bottom,Right'
$form.Controls.Add($continue)
$form.CancelButton = $abort
$form.AcceptButton = $continue
$form.add_FormClosing({ if ($form.DialogResult -ne [System.Windows.Forms.DialogResult]::OK) { $form.DialogResult = [System.Windows.Forms.DialogResult]::Cancel } })
$result = $form.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK -and $continue.Enabled) { exit 0 }
exit 1
