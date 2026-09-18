$patterns = @(
    'btnPlayX_Click',
    'A11:N612',
    'A11:N613',
    'A12:N612',
    '\$A\$11:\$A\$612',
    '\$B\$12:\$B\$612',
    'Worksheet_SelectionChange',
    'Worksheet_Change',
    'VerificaMatch',
    'VerificaMatchN',
    'CaricaFileVideo',
    'GetCartellaVideo',
    'vbGreen',
    'BackColor',
    'C:\\VSC_VIDEOCLIP',
    'VSC_VIDEOCLIP'
)
Get-ChildItem 'C:\VSC_Live_Server\_tmp_vbexport' -Filter *.bas | ForEach-Object {
    Write-Output "=== $_ ==="
    Select-String -Path $_.FullName -Pattern $patterns | ForEach-Object {
        Write-Output "Line $($_.LineNumber): $($_.Line.Trim())"
    }
}
