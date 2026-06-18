import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

excel_path = r'C:\VSC_Live_Server - WEB.worktrees\agents-bordero-html-css-js-conversion\Excel\Borderò - ver 13.1.69_con AutoHotkey da sistemare.xlsm'

if not Path(excel_path).exists():
    print(f"File not found: {excel_path}")
    exit(1)

try:
    with zipfile.ZipFile(excel_path, 'r') as zip_ref:
        file_list = zip_ref.namelist()
        print("=== WORKSHEETS / SHEETS ===\n")
        for f in sorted(file_list):
            if 'worksheets' in f.lower() or 'workbook' in f.lower():
                print(f)
        
        print("\n=== VBA MODULES ===\n")
        for f in sorted(file_list):
            if 'vba' in f.lower():
                print(f)
        
        print("\n=== DRAWINGS / CONTROLS ===\n")
        for f in sorted(file_list):
            if 'drawing' in f.lower() or 'control' in f.lower() or 'button' in f.lower():
                print(f)
        
        print("\n=== WORKBOOK CONTENT ===")
        try:
            wb_xml = zip_ref.read('xl/workbook.xml').decode('utf-8')
            root = ET.fromstring(wb_xml)
            # Extract sheet names
            ns = {'': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            for sheet in root.findall('sheets/sheet', ns):
                sheet_name = sheet.get('name')
                print(f"  Sheet: {sheet_name}")
        except:
            pass
        
        print("\n=== ALL FILES IN XLSM ===")
        for f in sorted(file_list)[:50]:
            print(f"  {f}")
        if len(file_list) > 50:
            print(f"  ... and {len(file_list) - 50} more files")
            
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
