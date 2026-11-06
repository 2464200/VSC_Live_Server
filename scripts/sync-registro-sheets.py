#!/usr/bin/env python3
"""Refresh CSV snapshots for every tab in the configured Registro Google Sheet."""

import csv
import json
import os
import re
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


SHEET_ID = "1SNiw3qc6bZ76duNSxIzxZ2GKHKO8XUpIcl_jZbXs5wY"
CONFIG = Path(__file__).resolve().parents[1] / "Bordero" / "config" / ".env"
OUTPUT = Path(__file__).resolve().parents[1] / "Registro"
MANIFEST = ".registro-sync-manifest.json"
API = f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}"
USER_AGENT = "VSC-Live-Server-Registro-Sync/1.0"


def read_api_key():
    """Read the existing ignored config file without printing credential values."""
    if not CONFIG.is_file():
        raise RuntimeError(f"Configurazione Google non trovata: {CONFIG.relative_to(CONFIG.parents[2])}")
    for line in CONFIG.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^\s*GOOGLE_API_KEY\s*=\s*(.*?)\s*$", line)
        if not match:
            continue
        value = match.group(1)
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        else:
            value = value.split("#", 1)[0].strip()
        if value:
            return value
    raise RuntimeError("GOOGLE_API_KEY mancante in Bordero/config/.env.")


def get_json(url, api_key, description):
    # Send the key in a header so it cannot appear in URLs or diagnostic output.
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "x-goog-api-key": api_key},
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        message = ""
        try:
            details = json.loads(error.read().decode("utf-8"))
            message = details.get("error", {}).get("message", "")
        except (UnicodeDecodeError, json.JSONDecodeError):
            pass
        detail = f": {message}" if message else ""
        raise RuntimeError(f"Google Sheets ha negato {description} (HTTP {error.code}){detail}") from None
    except urllib.error.URLError as error:
        raise RuntimeError(f"Connessione a Google Sheets non riuscita durante {description}: {error.reason}") from None
    except (TimeoutError, json.JSONDecodeError) as error:
        reason = "risposta JSON non valida" if isinstance(error, json.JSONDecodeError) else "timeout"
        raise RuntimeError(f"Google Sheets non ha completato {description}: {reason}") from None


def list_sheets(api_key):
    fields = "sheets(properties(title,index,gridProperties(rowCount,columnCount)))"
    query = urllib.parse.urlencode({"fields": fields})
    data = get_json(f"{API}?{query}", api_key, "la lettura dell'elenco delle schede")
    sheets = [item.get("properties", {}) for item in data.get("sheets", [])]
    sheets.sort(key=lambda sheet: sheet.get("index", 0))
    if not sheets:
        raise RuntimeError("Google Sheets non ha restituito alcuna scheda.")
    return sheets


def column_name(number):
    result = ""
    while number:
        number, remainder = divmod(number - 1, 26)
        result = chr(65 + remainder) + result
    return result or "A"


def sheet_range(sheet):
    """Quote the title and bound the request to the tab's grid dimensions."""
    title = sheet.get("title", "")
    quoted_title = "'" + title.replace("'", "''") + "'"
    grid = sheet.get("gridProperties") or {}
    rows = max(1, int(grid.get("rowCount", 1000)))
    columns = max(1, int(grid.get("columnCount", 26)))
    return f"{quoted_title}!A1:{column_name(columns)}{rows}"


def fetch_values(sheet, api_key):
    # FORMATTED_VALUE preserves the text users see, including date formats and zero padding.
    query = urllib.parse.urlencode({"valueRenderOption": "FORMATTED_VALUE"})
    range_path = urllib.parse.quote(sheet_range(sheet), safe="")
    data = get_json(f"{API}/values/{range_path}?{query}", api_key, f"la scheda {sheet.get('title', '')!r}")
    return data.get("values", [])


def safe_filename(sheet_name, used_names):
    """Keep valid tab names intact, sanitize Windows-invalid names and disambiguate collisions."""
    stem = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", sheet_name).rstrip(" .")
    if not stem:
        stem = "Scheda"
    if re.match(r"^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)", stem, re.IGNORECASE):
        stem = f"_{stem}"

    candidate = f"{stem}.csv"
    suffix = 2
    while candidate.casefold() in used_names:
        candidate = f"{stem}__{suffix}.csv"
        suffix += 1
    used_names.add(candidate.casefold())
    return candidate


def rows_for_csv(values):
    if not values:
        return []
    headers = [str(value) if value is not None else "" for value in values[0]]
    width = max((len(row) for row in values), default=0)
    headers.extend([""] * (width - len(headers)))
    keep_columns = [
        index for index, header in enumerate(headers)
        if not re.search(r"password|passcode|parola|secret", header, re.IGNORECASE)
    ]
    rows = []
    for row in values:
        normalized = ["" if value is None else str(value) for value in row]
        normalized.extend([""] * (width - len(normalized)))
        rows.append([normalized[index] if index < len(normalized) else "" for index in keep_columns])
    return rows


def main():
    api_key = read_api_key()
    sheets = list_sheets(api_key)

    # Fetch and prepare every sheet before touching any existing CSV.
    used_names = set()
    files = {}
    for sheet in sheets:
        title = sheet.get("title")
        if not title:
            raise RuntimeError("Google Sheets ha restituito una scheda senza nome.")
        filename = safe_filename(title, used_names)
        files[filename] = rows_for_csv(fetch_values(sheet, api_key))

    old_manifest_path = OUTPUT / MANIFEST
    old_files = []
    if old_manifest_path.is_file():
        try:
            old_files = json.loads(old_manifest_path.read_text(encoding="utf-8")).get("files", [])
        except (json.JSONDecodeError, OSError):
            old_files = []

    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="registro-sync-", dir=OUTPUT) as staging_name:
        staging = Path(staging_name)
        for filename, rows in files.items():
            with (staging / filename).open("w", encoding="utf-8-sig", newline="") as output:
                csv.writer(output, lineterminator="\r\n").writerows(rows)
        (staging / MANIFEST).write_text(
            json.dumps({"source": SHEET_ID, "files": sorted(files)}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        for filename in files:
            os.replace(staging / filename, OUTPUT / filename)
        os.replace(staging / MANIFEST, old_manifest_path)

    for filename in old_files:
        if filename not in files and Path(filename).name == filename and filename.lower().endswith(".csv"):
            (OUTPUT / filename).unlink(missing_ok=True)

    print(f"Registro aggiornato: {len(files)} CSV da Google Sheets.")
    for filename, rows in files.items():
        print(f"  {filename}: {max(0, len(rows) - 1)} righe")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # Keep startup failures visible in the VS Code task output.
        print(f"Errore aggiornando Registro da Google Sheets: {error}", file=sys.stderr)
        sys.exit(1)
