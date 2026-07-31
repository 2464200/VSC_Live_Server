import re, urllib.request
from pathlib import Path

files = ['script.js','public/mobile-script.js','public/index0.html','public/index1.html','public/index2.html','public/servizio.html','public/diagnostica.html','public/test-csv-loading.html','public/test-bordero-frontend.html','Playlist-country/script.js','Bordero/pages/display.js','Bordero/pages/videoclip.js','Eventi/public/coreografie-aggiuntive.js']
checks = []
for f in files:
    p = Path(f)
    if p.exists():
        text = p.read_text(encoding='utf-8', errors='ignore')
        for m in re.finditer(r'(?:fetch\(|src=|href=)[^\n]*?(https?://[^\s"\']+|/[^\s"\']+|[^\s"\']+\.csv[^\s"\']*|[^\s"\']+\.json[^\s"\']*)', text):
            val = m.group(1)
            if val.startswith(('http://','https://','mailto:','tel:','javascript:','#','data:')):
                continue
            if val.startswith('/') or val.endswith(('.csv','.json','.html','.js','.css')):
                checks.append((f, val))

print('PATHS_FOUND', len(checks))
for src, val in checks:
    if val.startswith('/'):
        try:
            with urllib.request.urlopen('http://127.0.0.1:5500' + val, timeout=8) as r:
                print(src, '->', val, 'HTTP', r.status)
        except Exception as e:
            print(src, '->', val, 'ERROR', repr(e))
    else:
        target = (Path(src).parent / val).resolve()
        print(src, '->', val, 'FILE', 'OK' if target.exists() else 'MISSING')
