#!/usr/bin/env python3
"""Refresh local CSV snapshots for every tab in the Registro Google Sheet."""

import csv
import datetime as dt
import json
import os
import re
import shutil
import sys
import tempfile
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


SHEET_ID = "1SNiw3qc6bZ76duNSxIzxZ2GKHKO8XUpIcl_jZbXs5wY"
EXPORT_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=xlsx"
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "Registro"
MANIFEST = ".registro-sync-manifest.json"
NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkg": "http://schemas.openxmlformats.org/package/2006/relationships",
}
BUILTIN_DATE_FORMATS = set(range(14, 23)) | {27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47} | set(range(50, 59))


def download_workbook():
    request = urllib.request.Request(EXPORT_URL, headers={"User-Agent": "VSC-Live-Server-Registro-Sync/1.0"})
    with urllib.request.urlopen(request, timeout=45) as response:
        if response.status != 200:
            raise RuntimeError(f"Google Sheets ha risposto con HTTP {response.status}.")
        return response.read()


def zip_xml(archive, name):
    return ET.fromstring(archive.read(name))


def shared_strings(archive):
    try:
        root = zip_xml(archive, "xl/sharedStrings.xml")
    except KeyError:
        return []
    return ["".join(text.text or "" for text in item.findall(".//main:t", NS)) for item in root.findall("main:si", NS)]


def date_style_ids(archive):
    try:
        root = zip_xml(archive, "xl/styles.xml")
    except KeyError:
        return set()
    custom = {
        int(item.attrib["numFmtId"]): item.attrib.get("formatCode", "")
        for item in root.findall("main:numFmts/main:numFmt", NS)
    }
    xfs = root.find("main:cellXfs", NS)
    if xfs is None:
        return set()
    result = set()
    for style_id, xf in enumerate(xfs):
        fmt_id = int(xf.attrib.get("numFmtId", "0"))
        fmt = re.sub(r'"[^"]*"|\\.', "", custom.get(fmt_id, "")).lower()
        if fmt_id in BUILTIN_DATE_FORMATS or re.search(r"[ydhs]", fmt) or re.search(r"m{1,4}", fmt):
            result.add(style_id)
    return result


def workbook_sheets(archive):
    workbook = zip_xml(archive, "xl/workbook.xml")
    relationships = zip_xml(archive, "xl/_rels/workbook.xml.rels")
    targets = {
        item.attrib["Id"]: item.attrib["Target"]
        for item in relationships.findall("pkg:Relationship", NS)
    }
    sheets = []
    for sheet in workbook.findall("main:sheets/main:sheet", NS):
        name = sheet.attrib["name"]
        if name.casefold() == "foglio1":
            continue
        relation_id = sheet.attrib[f"{{{NS['rel']}}}id"]
        target = targets[relation_id].lstrip("/")
        if not target.startswith("xl/"):
            target = f"xl/{target}"
        sheets.append((name, target))
    return sheets


def column_index(cell_ref):
    letters = re.match(r"[A-Z]+", cell_ref)
    if not letters:
        raise ValueError(f"Riferimento cella non valido: {cell_ref}")
    index = 0
    for char in letters.group(0):
        index = index * 26 + ord(char) - ord("A") + 1
    return index - 1


def cell_value(cell, strings, date_styles):
    value_node = cell.find("main:v", NS)
    cell_type = cell.attrib.get("t", "")
    if cell_type == "inlineStr":
        inline = cell.find("main:is", NS)
        return "" if inline is None else "".join(node.text or "" for node in inline.findall(".//main:t", NS))
    if value_node is None or value_node.text is None:
        return ""
    value = value_node.text
    if cell_type == "s":
        return strings[int(value)]
    if cell_type == "b":
        return "TRUE" if value == "1" else "FALSE"
    if cell_type in {"str", "e"}:
        return value
    if cell.attrib.get("s") and int(cell.attrib["s"]) in date_styles:
        serial = float(value)
        date_value = dt.datetime(1899, 12, 30) + dt.timedelta(days=serial)
        if date_value.time() == dt.time():
            return date_value.date().isoformat()
        return date_value.isoformat(sep=" ")
    number = float(value)
    if number.is_integer():
        return str(int(number))
    return value


def worksheet_rows(archive, sheet_path, strings, date_styles):
    root = zip_xml(archive, sheet_path)
    rows = []
    for row_node in root.findall("main:sheetData/main:row", NS):
        values = []
        for cell in row_node.findall("main:c", NS):
            col = column_index(cell.attrib["r"])
            if len(values) <= col:
                values.extend([""] * (col + 1 - len(values)))
            values[col] = cell_value(cell, strings, date_styles)
        while values and values[-1] == "":
            values.pop()
        if any(value != "" for value in values):
            rows.append(values)
    return rows


def safe_filename(sheet_name):
    filename = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", sheet_name).strip(" .")
    if not filename or filename.upper() in {"CON", "PRN", "AUX", "NUL"} or re.fullmatch(r"(?:COM|LPT)[1-9]", filename.upper()):
        raise ValueError(f"Nome scheda non utilizzabile come file: {sheet_name!r}")
    return f"{filename}.csv"


def without_secret_columns(rows):
    if not rows:
        return rows
    headers = rows[0]
    keep = [index for index, header in enumerate(headers) if not re.search(r"password|passcode|parola|secret|codice", header, re.I)]
    return [[row[index] if index < len(row) else "" for index in keep] for row in rows]


def main():
    workbook_bytes = download_workbook()
    with zipfile.ZipFile(__import__("io").BytesIO(workbook_bytes)) as archive:
        strings = shared_strings(archive)
        styles = date_style_ids(archive)
        sheets = workbook_sheets(archive)
        if not sheets:
            raise RuntimeError("Non sono state trovate schede da esportare dopo l’esclusione di Foglio1.")
        files = {}
        for name, path in sheets:
            filename = safe_filename(name)
            if filename.casefold() in {item.casefold() for item in files}:
                raise RuntimeError(f"Più schede generano lo stesso nome file: {filename}")
            rows = without_secret_columns(worksheet_rows(archive, path, strings, styles))
            if not rows:
                rows = [[]]
            files[filename] = rows

    OUTPUT.mkdir(parents=True, exist_ok=True)
    old_manifest_path = OUTPUT / MANIFEST
    old_files = []
    if old_manifest_path.is_file():
        try:
            old_files = json.loads(old_manifest_path.read_text(encoding="utf-8")).get("files", [])
        except (json.JSONDecodeError, OSError):
            old_files = []

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
