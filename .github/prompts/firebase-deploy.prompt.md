**⚠️ Nota importante:** a partire dal 13 Apr 2026 il flusso standard del progetto usa un unico unified-server.js su http://localhost:5500. Le architetture con server-manager.js, pdf-server.js, simple-server.js, static-server.js, pdf-server-simple.js e le porte 3000, 3010, 8765 sono ora legacy/historiche e non fanno parte del percorso standard.

---
description: "Automate Firebase deployment with pre-deploy checks and CSV sync"
name: "Firebase Deploy"
argument-hint: "Confirm deployment readiness"
agent: "agent"
tools: ["run_in_terminal", "read_file", "file_search"]
---

Execute the Firebase deployment checklist for the VSC_Live_Server project:

1. **Sync CSVs**: Copy display.csv and NextCoreo.csv from root to public/ folder to ensure deployed site has latest data.

2. **Local Testing**:
   - Start all servers (web on 5500, manager on 3000, pdf on 8765)
   - Verify index.html loads correctly at localhost:5500
   - Verify public/mobile.html loads and renders cards
   - Verify Prova/ScriptPDF1.html auto-starts PDF server
   - Check that CSV data is fresh (no stale cache) and BOM-stripped properly

3. **Deploy**: Run `firebase deploy --only hosting`

4. **Post-Deploy Verification**:
   - Open deployed Firebase URL
   - Confirm CSV data loads fresh (not cached)
   - Verify all pages work as expected

Use terminal commands for server startup, file copying, and deployment. Report any failures and suggest fixes.

