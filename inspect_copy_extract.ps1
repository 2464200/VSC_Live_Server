Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = 'C:\VSC_Live_Server\_tmp_BorderoCopy.xlsm'
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
$zip.Entries | Where-Object { $_.FullName -match 'vbaProject.bin|xl/worksheets/|xl/activeX/|xl/drawings/' } | Select-Object FullName, Length | Format-Table
$entry = $zip.GetEntry('xl/vbaProject.bin')
$dst = 'C:\VSC_Live_Server\_tmp_vbaProject.bin'
if (Test-Path $dst) { Remove-Item $dst -Force }
$entry.ExtractToFile($dst)
$zip.Dispose()
Write-Output 'extracted'
