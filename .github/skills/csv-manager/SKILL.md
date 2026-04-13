**⚠️ Nota importante:** a partire dal 13 Apr 2026 il flusso standard del progetto usa un unico unified-server.js su http://localhost:5500. Le architetture con server-manager.js, pdf-server.js, simple-server.js, static-server.js, pdf-server-simple.js e le porte 3000, 3010, 8765 sono ora legacy/historiche e non fanno parte del percorso standard.

---
name: csv-manager
description: 'Manage CSV files for the project: validate structure, sync to public/, add columns safely. Use for CSV editing, deployment prep, data integrity checks.'
argument-hint: 'Action: validate, sync, add-column'
---

# CSV Manager

## When to Use
- Before deployment: sync CSVs to public/
- After editing CSVs: validate structure and update consumers
- Adding new columns: ensure all scripts handle the change

## Procedures

### Validate CSV Structure
Run [validate_csv.py](./scripts/validate_csv.py) to check display.csv and NextCoreo.csv for:
- First 3 lines are headers (skipped)
- Column 0 is flag column
- No empty rows
- BOM presence (should be stripped in code)

### Sync to Public
Run [sync_csvs.ps1](./scripts/sync_csvs.ps1) to copy root CSVs to public/ folder.

### Add New Column
1. Edit display.csv manually
2. Run validation
3. Update [script.js](../../script.js) and [public/mobile-script.js](../../public/mobile-script.js) to handle new column
4. Test rendering

Use this skill to avoid breaking the data-driven architecture.

