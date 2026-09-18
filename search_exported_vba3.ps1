$patterns = @(
    'A613',
    'A11:N613',
    '\$A\$11:\$A613',
    '\$A\$11:\$A\$613',
    '\$B\$12:\$B\$613'
)
Get-ChildItem 'C:\VSC_Live_Server\_tmp_vbexport' -Filter *.bas | ForEach-Object {
    Write-Output "=== $($_.Name) ==="
    $matches = Select-String -Path $_.FullName -Pattern $patterns
    foreach ($m in $matches) {
        Write-Output "  $($m.LineNumber): $($m.Line.Trim())"
    }
}
