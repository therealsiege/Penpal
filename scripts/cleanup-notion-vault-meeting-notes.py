#!/usr/bin/env python3
"""
Strip Open Loop Notion-import noise from meeting-note markdown:
- YAML frontmatter when source is notion-olh-export
- The standard Historical blockquote that follows
- Optional: rename 'Title (8hex).md' -> 'Title 8hex.md' when no collision

Usage:
  python3 cleanup-notion-vault-meeting-notes.py /path/to/Shared\\ Meeting\\ Notes
  python3 ... --dry-run
"""
from __future__ import annotations

import argparse
import re
import sys
import urllib.parse
from pathlib import Path

HISTORICAL_RE = re.compile(
    r"^> \*\*Historical:\*\* Imported from the OpenLoop Health Notion .Meeting Notes. export\. "
    r"May be stale or superseded by curated KB docs \(see `About/Primer\.md`\)\.\s*\n+",
    re.MULTILINE,
)

FRONTMATTER_RE = re.compile(
    r"^---\n(?P<body>.*?)\n---\n+",
    re.DOTALL,
)

UUID_SUFFIX_RE = re.compile(r" \(([0-9a-f]{8})\)\.md$", re.IGNORECASE)


def is_notion_olh_frontmatter(body: str) -> bool:
    return "source: notion-olh-export" in body or "notion-olh-export" in body


def strip_noise(text: str) -> tuple[str, bool]:
    """Return (new_text, changed)."""
    m = FRONTMATTER_RE.match(text)
    if not m:
        return text, False
    body = m.group("body")
    if not is_notion_olh_frontmatter(body):
        return text, False
    rest = text[m.end() :]
    new = HISTORICAL_RE.sub("", rest, count=1)
    if new == rest:
        new = rest
    return new, True


def safe_rename_uuid(path: Path, dry_run: bool) -> tuple[Path, Path] | None:
    m = UUID_SUFFIX_RE.search(path.name)
    if not m:
        return None
    short = m.group(1)
    new_name = UUID_SUFFIX_RE.sub(f" {short}.md", path.name)
    dest = path.with_name(new_name)
    if dest.exists():
        return None
    if dry_run:
        print(f"rename: {path.name} -> {new_name}")
        return (path, dest)
    path.rename(dest)
    print(f"renamed: {path} -> {dest}")
    return (path, dest)


def fix_links_after_renames(root: Path, pairs: list[tuple[Path, Path]]) -> int:
    """Update markdown links that pointed at old basenames (incl. URL-encoded)."""
    if not pairs:
        return 0
    subs: list[tuple[str, str, str, str]] = []
    for old, new in pairs:
        o, n = old.name, new.name
        subs.append(
            (
                o,
                n,
                urllib.parse.quote(o, safe="/@+&"),
                urllib.parse.quote(n, safe="/@+&"),
            )
        )
    n_files = 0
    for path in root.rglob("*.md"):
        text = path.read_text(encoding="utf-8", errors="replace")
        orig = text
        for plain_old, plain_new, enc_old, enc_new in subs:
            text = text.replace(plain_old, plain_new)
            text = text.replace(enc_old, enc_new)
        if text != orig:
            n_files += 1
            path.write_text(text, encoding="utf-8", newline="\n")
    return n_files


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("root", type=Path, help="Vault folder (e.g. Shared Meeting Notes)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-rename-uuid", action="store_true", help="Skip Title (hex).md renames")
    args = ap.parse_args()
    root: Path = args.root.expanduser().resolve()
    if not root.is_dir():
        print(f"Not a directory: {root}", file=sys.stderr)
        return 2

    changed_files = 0
    renamed = 0
    for path in sorted(root.rglob("*.md")):
        text = path.read_text(encoding="utf-8", errors="replace")
        new_text, stripped = strip_noise(text)
        if stripped and new_text != text:
            if args.dry_run:
                print(f"strip frontmatter: {path.relative_to(root)}")
            else:
                path.write_text(new_text, encoding="utf-8", newline="\n")
            changed_files += 1

    rename_pairs: list[tuple[Path, Path]] = []
    if not args.no_rename_uuid:
        for path in sorted(root.rglob("*.md")):
            pair = safe_rename_uuid(path, args.dry_run)
            if pair:
                renamed += 1
                rename_pairs.append(pair)

    if args.dry_run:
        link_fixes = 0
    else:
        link_fixes = fix_links_after_renames(root, rename_pairs)

    for ds in root.rglob(".DS_Store"):
        if args.dry_run:
            print(f"remove: {ds.relative_to(root)}")
        else:
            ds.unlink(missing_ok=True)

    print(
        f"Done. Stripped frontmatter in {changed_files} files; "
        f"uuid renames: {renamed}; link fixes: {link_fixes}; dry_run={args.dry_run}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
