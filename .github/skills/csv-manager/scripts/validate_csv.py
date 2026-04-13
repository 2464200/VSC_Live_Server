#!/usr/bin/env python3
"""
CSV Validation Script for VSC_Live_Server
Validates display.csv and NextCoreo.csv structure
"""

import csv
import os
import sys

def validate_csv(file_path, name):
    if not os.path.exists(file_path):
        print(f"ERROR: {file_path} not found")
        return False

    with open(file_path, 'r', encoding='utf-8-sig') as f:  # utf-8-sig handles BOM
        lines = f.readlines()

    if len(lines) < 4:
        print(f"ERROR: {name} has fewer than 4 lines")
        return False

    # Check first 3 lines are headers (should be skipped)
    if not lines[0].strip() or not lines[1].strip() or not lines[2].strip():
        print(f"WARNING: {name} first 3 lines may not be proper headers")

    # Parse CSV from line 4
    csv_reader = csv.reader(lines[3:])
    rows = list(csv_reader)

    if not rows:
        print(f"ERROR: {name} has no data rows after headers")
        return False

    # Check column 0 is flag (can be empty or 'X')
    for i, row in enumerate(rows):
        if len(row) == 0:
            print(f"ERROR: {name} row {i+4} is empty")
            return False
        if row[0] not in ('', 'X'):
            print(f"WARNING: {name} row {i+4} column 0 is '{row[0]}' (expected '' or 'X')")

    print(f"SUCCESS: {name} validation passed")
    return True

def main():
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))  # Go up to workspace root

    display_csv = os.path.join(root_dir, 'display.csv')
    nextcoreo_csv = os.path.join(root_dir, 'NextCoreo.csv')

    success = True
    success &= validate_csv(display_csv, 'display.csv')
    success &= validate_csv(nextcoreo_csv, 'NextCoreo.csv')

    if success:
        print("All CSVs validated successfully")
        sys.exit(0)
    else:
        print("CSV validation failed")
        sys.exit(1)

if __name__ == '__main__':
    main()