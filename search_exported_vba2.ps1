$patterns = @(
    'A11:N612',
    'A11:N613',
    'A12:N612',
    '$A$11:$A$612',
    '$A$11:$A613',
    '$B$12:$B$612',
    'Range("A11:N612")',
    'Range("A11:N613")',
    'Range("$A$11:$A$612")',
    'Range("$A$11:$A613")',
    'Intersect(Target, Range("$B$12:$B$612"))',
    'A10:A210',
    'c:\\vsc_videoclip\\'
)
Get-ChildItem 'C:\VSC_Live_Server\_tmp_vbexport' -Filter *.bas | ForEach-Object {
    Write-Output "=== $($_.Name) ==="
    $matches = Select-String -Path $_.FullName -Pattern $patterns
    foreach ($m in $matches) {
        Write-Output "  $($m.LineNumber): $($m.Line.Trim())"
    }
}
