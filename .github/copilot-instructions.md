**⚠️ Nota importante:** a partire dal 13 Apr 2026 il flusso standard del progetto usa un unico unified-server.js su http://localhost:5500. Le architetture con server-manager.js, pdf-server.js, simple-server.js, static-server.js, pdf-server-simple.js e le porte 3000, 3010, 8765 sono ora legacy/historiche e non fanno parte del percorso standard.

<!-- Repository-specific guidance for AI coding agents -->
# Copilot instructions for this repository

Purpose: concise, actionable guidance so an AI helper can be productive immediately.

**Project type:** static client-side site (plain HTML/CSS/JS). No build step. The `public/` folder is the Firebase-hosted output (see `firebase.json`).

**Big picture & architecture**
-- Single-page/static UI variants: `index.html`, `index1.html`, `index2.html` (desktop) and `public/mobile1.html` (mobile).
- Data-driven: CSV files (`display.csv`, `NextCoreo.csv`) are the primary data source. The app fetches CSVs at runtime and renders tables/cards.
- Deployment: Firebase Hosting serves the `public/` folder. During development the root copies of CSVs can be edited, but only files under `public/` are deployed.

**Key files (quick map)**
- `script.js` â€” desktop scrolling/table renderer. Uses `fetch('display.csv', {cache: 'no-store'})`, skips first 3 lines with `.split('\n').slice(3)`, and treats column 0 as a flag (`'X'` => executed).
- `public/mobile-script.js` â€” mobile card UI. Also skips first 3 rows and maps CSV columns to `{id,name,song,author,choreographer}`. Speed is pixels/second (px/s).
- `index.html` / header â€” contains `#next-coreo` UI element and includes `script.js`.
- `display.csv` (root) and `public/display.csv` (deployed) â€” keep them in sync before deploying.
- `NextCoreo.csv` (root & `public/`) â€” used to show a single label (cell A1). Code strips BOMs and uses cache-busting query strings.

**Project-specific conventions to preserve**
- CSV parsing always skips the first 3 lines: do NOT remove `.slice(3)` unless you update every consumer.
- First CSV column is a flag column (index 0). Most renderers skip it and show columns from index 1 onward.
- Desktop vs mobile scroll math differs: desktop uses time-stepped increments (ms per step), mobile uses px/s; keep both in sync when changing UX.
- Fullscreen handling: both `script.js` and `public/mobile-script.js` implement `toggleFullscreen()` and restart scrolling on fullscreen changes â€” preserve this to avoid visual jumps.

**Developer workflows & commands (PowerShell)**
- Run a quick local static server from repo root:
```powershell
python -m http.server 8000
# or
npx http-server -c-1
```
- Deploy to Firebase (ensure `public/` contains the final CSVs/assets):
```powershell
firebase login
firebase deploy --only hosting
```
- Local Firebase testing:
```powershell
firebase emulators:start
```

**Editing data or CSV format â€” checklist**
- If you change the CSV column layout, update ALL consumers: `script.js`, `public/mobile-script.js`, and any other file that `fetch`es `display.csv`.
- Update both `display.csv` in repo root and `public/display.csv` (deployed). The hosted site serves from `public/`.

**Examples & implementation notes**
- NextCoreo fetch example (cache-bust + BOM strip):
  - `fetch('NextCoreo.csv?t=' + Date.now(), { cache: 'no-store' })` then remove BOM with `text.replace(/^\\uFEFF/, '')` and take the first CSV cell.
- Mobile card mapping (see `public/mobile-script.js`): `cols[1] -> id, cols[2] -> name, cols[3] -> song, cols[4] -> author, cols[5] -> choreographer`.

**Testing & verification**
- No automated tests. Manual flow:
  1. Start local server, open `/index.html` and `/public/mobile1.html`.
  2. Verify CSV rows render, `X` flagged rows are styled orange, and `NextCoreo.csv` shows the A1 value.
  3. Toggle fullscreen and confirm scrolling restarts without jumps.

**What to watch out for**
- Duplicate CSVs: edits to root CSV won't affect deployed site unless copied to `public/`.
- Browser caching: scripts add `cache: 'no-store'` and timestamp query strings, but use `-c-1` in `http-server` during development to be safe.
- Animation math differences (desktop vs mobile) â€” update both implementations.

If anything here is unclear or you want more line-level references to examples in `script.js` / `public/mobile-script.js`, tell me which area to expand.


