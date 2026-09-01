"""Verify static internal HTML links through the unified development server."""

from __future__ import annotations

import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "http://localhost:5500"
HTML_LINK_PATTERN = re.compile(r"<a\b[^>]*?\bhref\s*=\s*['\"]([^'\"]+)['\"]", re.IGNORECASE)
SKIPPED_PREFIXES = ("#", "javascript:", "mailto:", "tel:", "data:", "http://", "https://", "//")


def read_html(path: Path) -> str:
    raw = path.read_bytes()
    return raw.decode("utf-16le" if b"\x00" in raw else "utf-8", errors="replace")


def served_path(relative_path: str) -> str:
    if relative_path.startswith("public/"):
        return f"/{relative_path[7:]}"
    if relative_path.startswith("Eventi/public/"):
        return f"/eventi/{relative_path[14:]}"
    if relative_path.startswith("LedDisplay/server/static/"):
        return f"/led-display/{relative_path[25:]}"
    return f"/{relative_path}"


def main() -> int:
    links: dict[str, list[str]] = defaultdict(list)

    for page in ROOT.rglob("*.html"):
        if "node_modules" in page.parts:
            continue

        relative = page.relative_to(ROOT).as_posix()
        if relative == "public/nav.html":
            continue

        base_url = urllib.parse.urljoin(ORIGIN, served_path(relative))
        for href in HTML_LINK_PATTERN.findall(read_html(page)):
            href = href.strip()
            if not href or href.lower().startswith(SKIPPED_PREFIXES):
                continue

            target = urllib.parse.urljoin(base_url, href)
            parsed = urllib.parse.urlsplit(target)
            if parsed.netloc != urllib.parse.urlsplit(ORIGIN).netloc:
                continue

            links[urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, parsed.query, ""))].append(relative)

    failures: list[tuple[str, str, list[str]]] = []
    for url, sources in sorted(links.items()):
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                if not 200 <= response.status < 400:
                    failures.append((str(response.status), url, sources))
        except urllib.error.HTTPError as error:
            failures.append((str(error.code), url, sources))
        except urllib.error.URLError as error:
            failures.append((str(error.reason), url, sources))

    print(f"CHECKED_INTERNAL_LINKS={len(links)}")
    print(f"BROKEN_INTERNAL_LINKS={len(failures)}")
    for status, url, sources in failures:
        print(f"{status} {url} <- {', '.join(sources)}")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
