$patterns = @('A11', '612')
Get-ChildItem 'C:\VSC_Live_Server\_tmp_vbexport' -Filter *.bas | ForEach-Object {
    $matches = Select-String -Path $_.FullName -Pattern $patterns
    if ($matches) {
        Write-Output "=== $($_.Name) ==="
        foreach ($m in $matches) {
            Write-Output "  $($m.LineNumber): $($m.Line.Trim())"
        }
    }
}
