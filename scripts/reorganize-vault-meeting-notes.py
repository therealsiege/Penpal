#!/usr/bin/env python3
"""
Reorganize Notion-exported meeting notes: archive misfiled trees, dedupe identical
files (stub + canonical), normalize root date filenames, optional year folders.

Default is --dry-run. Use --apply to write changes.

Example:
  python3 reorganize-vault-meeting-notes.py "/path/to/Shared Meeting Notes"
  python3 reorganize-vault-meeting-notes.py "/path/to/Shared Meeting Notes" --apply
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
import urllib.parse
from pathlib import Path

STUB_MARK = "This file was an exact duplicate of another note"


def pad(n: int) -> str:
    return f"{n:02d}"


def try_parse_date_prefix(stem: str) -> str | None:
    """
    Return normalized stem (ISO date + rest) if stem starts with a parseable date.
    """
    s = stem
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})\s+(.+)$", s)
    if m:
        y, mo, d, rest = int(m[1]), int(m[2]), int(m[3]), m[4]
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{y}-{pad(mo)}-{pad(d)} {rest}"

    m = re.match(r"^(\d{1,2})-(\d{1,2})-(\d{4})\s+(.+)$", s)
    if m:
        mo, d, y, rest = int(m[1]), int(m[2]), int(m[3]), m[4]
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{y}-{pad(mo)}-{pad(d)} {rest}"

    m = re.match(r"^(\d{2})-(\d{2})-(\d{4})\s+(.+)$", s)
    if m:
        mo, d, y, rest = int(m[1]), int(m[2]), int(m[3]), m[4]
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{y}-{pad(mo)}-{pad(d)} {rest}"

    m = re.match(r"^(\d{1,2})-(\d{1,2})-(\d{2})$", s)
    if m:
        mo, d, yy = int(m[1]), int(m[2]), int(m[3])
        y = 2000 + yy if yy < 70 else 1900 + yy
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{y}-{pad(mo)}-{pad(d)} "

    return None


def title_from_markdown(path: Path) -> str | None:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None
    for line in text.splitlines()[:40]:
        if line.startswith("# ") and not line.startswith("# @") and "Promoted from Notion" not in line:
            t = line[2:].strip()
            if t and len(t) < 200:
                return t
    return None


def slug_filename(title: str) -> str:
    t = re.sub(r'[<>:"/\\|?*]', "", title)
    t = re.sub(r"\s+", " ", t).strip()
    return t[:180] if len(t) > 180 else t


def strip_redundant_date_prefix(iso: str, title: str) -> str:
    """If title starts with same YYYY-MM-DD, drop it from the filename slug."""
    t = title.strip()
    prefix = f"{iso} "
    if t.startswith(prefix):
        return slug_filename(t[len(prefix) :])
    return slug_filename(t)


def vault_wikilink(target_rel: str) -> str:
    p = target_rel.replace("\\", "/")
    if p.endswith(".md"):
        p = p[: -len(".md")]
    return p


def rel_to(base: Path, p: Path) -> str:
    return str(p.resolve().relative_to(base.resolve())).replace("\\", "/")


def apply_link_replacements(text: str, replacements: list[tuple[str, str]]) -> str:
    for old, new in replacements:
        if old == new:
            continue
        enc_old = urllib.parse.quote(old, safe="/@+&'")
        enc_new = urllib.parse.quote(new, safe="/@+&'")
        text = text.replace(old, new)
        text = text.replace(enc_old, enc_new)
        old_w = old[:-3] if old.endswith(".md") else old
        new_w = new[:-3] if new.endswith(".md") else new
        text = text.replace(f"[[{old_w}]]", f"[[{new_w}]]")
        text = text.replace(f"[[{old}]]", f"[[{new_w}]]")
    return text


def apply_substring_link_fixes(text: str, pairs: list[tuple[str, str]]) -> str:
    for old, new in pairs:
        text = text.replace(old, new)
        text = text.replace(
            urllib.parse.quote(old, safe="/@+&'"),
            urllib.parse.quote(new, safe="/@+&'"),
        )
    return text


def fix_all_links(
    root: Path,
    replacements: list[tuple[str, str]],
    substr_pairs: list[tuple[str, str]],
    dry_run: bool,
) -> int:
    n = 0
    for path in root.rglob("*.md"):
        text = path.read_text(encoding="utf-8", errors="replace")
        new = apply_link_replacements(text, replacements)
        new = apply_substring_link_fixes(new, substr_pairs)
        if new != text:
            n += 1
            if not dry_run:
                path.write_text(new, encoding="utf-8", newline="\n")
    return n


def hash_file(p: Path) -> str:
    h = hashlib.sha256()
    h.update(p.read_bytes())
    return h.hexdigest()


def is_stub_file(path: Path) -> bool:
    try:
        return STUB_MARK in path.read_text(encoding="utf-8", errors="replace")[:800]
    except OSError:
        return False


def dedupe_identical(base: Path, dry_run: bool, max_bytes: int = 500_000) -> list[dict]:
    groups: dict[str, list[Path]] = {}
    for p in base.rglob("*.md"):
        if "_archive" in p.parts or "_shared" in p.parts:
            continue
        if is_stub_file(p):
            continue
        try:
            sz = p.stat().st_size
        except OSError:
            continue
        if sz == 0 or sz > max_bytes:
            continue
        groups.setdefault(hash_file(p), []).append(p)

    journal: list[dict] = []

    for _digest, paths in sorted(groups.items(), key=lambda x: x[0]):
        if len(paths) < 2:
            continue
        paths_sorted = sorted(paths, key=lambda x: rel_to(base, x))
        canonical = paths_sorted[0]
        crel = rel_to(base, canonical)
        link = vault_wikilink(crel)
        for dup in paths_sorted[1:]:
            drel = rel_to(base, dup)
            stub = (
                f"# {dup.stem}\n\n"
                "_This file was an exact duplicate of another note (same bytes), "
                "typically from a Notion export. The canonical copy is:_\n\n"
                f"[[{link}]]\n"
            )
            journal.append({"action": "stub_duplicate", "canonical": crel, "duplicate": drel})
            if dry_run:
                print(f"[dry-run] stub duplicate -> canonical\n  dup: {drel}\n  can: {crel}")
            else:
                dup.write_text(stub, encoding="utf-8", newline="\n")
                print(f"stubbed duplicate: {drel} -> [[{link}]]")

    return journal


def archive_misplaced_school(base: Path, dry_run: bool, log: list) -> bool:
    src = base / "Sprint Gift Horse" / "SCHOOL SCHEDULE"
    if not src.is_dir():
        return False
    dest = base / "_archive" / "misplaced" / "Sprint Gift Horse SCHOOL SCHEDULE"
    entry = {"action": "archive_tree", "from": rel_to(base, src), "to": rel_to(base, dest)}
    log.append(entry)
    if dry_run:
        print(f"[dry-run] would move tree to {dest.relative_to(base)}")
        return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dest))
    print(f"archived: {src.relative_to(base)} -> {dest.relative_to(base)}")
    return True


def rename_root_dates(base: Path, dry_run: bool, log: list) -> list[tuple[str, str]]:
    repl: list[tuple[str, str]] = []
    root_mds = sorted([p for p in base.iterdir() if p.is_file() and p.suffix == ".md"])
    for p in root_mds:
        stem = p.stem
        parsed = try_parse_date_prefix(stem)
        if not parsed:
            continue
        new_stem = parsed.rstrip()
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", new_stem):
            iso = new_stem
            tit = title_from_markdown(p)
            if tit:
                rest = strip_redundant_date_prefix(iso, tit)
                new_stem = f"{iso} {rest}" if rest else f"{iso} (untitled)"
            else:
                new_stem = f"{iso} (untitled)"
        new_name = new_stem + ".md"
        if new_name == p.name:
            continue
        dest = base / new_name
        old_r = rel_to(base, p)
        if dest.exists():
            target_link = vault_wikilink(rel_to(base, dest))
            stub = (
                f"# {p.stem}\n\n"
                "_Renaming would overwrite an existing note. This file is kept as a pointer; "
                "merge any unique content manually if needed._\n\n"
                f"[[{target_link}]]\n"
            )
            log.append({"action": "stub_rename_collision", "from": old_r, "target": rel_to(base, dest)})
            if dry_run:
                print(f"[dry-run] stub (collision): {p.name} -> points to {new_name}")
            else:
                p.write_text(stub, encoding="utf-8", newline="\n")
                print(f"stubbed collision: {p.name} -> [[{target_link}]]")
            continue
        new_r = rel_to(base, dest)
        log.append({"action": "rename", "from": old_r, "to": new_r})
        repl.append((old_r, new_r))
        if dry_run:
            print(f"[dry-run] rename: {p.name} -> {new_name}")
        else:
            p.rename(dest)
            print(f"renamed: {p.name} -> {new_name}")
    return repl


def move_root_by_year(base: Path, dry_run: bool, log: list) -> list[tuple[str, str]]:
    repl: list[tuple[str, str]] = []
    for p in list(base.iterdir()):
        if not p.is_file() or p.suffix != ".md":
            continue
        m = re.match(r"^(\d{4})-\d{2}-\d{2}\s", p.name)
        if not m:
            continue
        year = m.group(1)
        year_dir = base / year
        dest = year_dir / p.name
        if dest.exists():
            print(f"skip move-by-year (exists): {dest}", file=sys.stderr)
            continue
        old_r = rel_to(base, p)
        new_r = rel_to(base, dest)
        log.append({"action": "move_year", "from": old_r, "to": new_r})
        repl.append((old_r, new_r))
        if dry_run:
            print(f"[dry-run] move: {p.name} -> {year}/{p.name}")
        else:
            year_dir.mkdir(parents=True, exist_ok=True)
            shutil.move(str(p), str(dest))
            print(f"moved: {p.name} -> {year}/{p.name}")
    return repl


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("vault", type=Path, help="Path to Shared Meeting Notes folder")
    ap.add_argument("--apply", action="store_true", help="Perform changes (default dry-run)")
    ap.add_argument("--no-archive-school", action="store_true")
    ap.add_argument("--no-dedupe", action="store_true")
    ap.add_argument("--no-rename-dates", action="store_true")
    ap.add_argument("--move-by-year", action="store_true", help="Move root ISO-dated notes into YYYY/")
    args = ap.parse_args()
    base = args.vault.expanduser().resolve()
    if not base.is_dir():
        print(f"Not a directory: {base}", file=sys.stderr)
        return 2

    dry_run = not args.apply
    log: list = []
    all_repl: list[tuple[str, str]] = []
    substr_pairs: list[tuple[str, str]] = []

    if dry_run:
        print("DRY RUN — no files modified. Pass --apply to execute.\n")

    archived_school = False
    if not args.no_archive_school:
        archived_school = archive_misplaced_school(base, dry_run, log)
        if archived_school:
            substr_pairs.append(
                (
                    "Sprint Gift Horse/SCHOOL SCHEDULE",
                    "_archive/misplaced/Sprint Gift Horse SCHOOL SCHEDULE",
                )
            )

    if not args.no_dedupe:
        log.extend(dedupe_identical(base, dry_run))

    if not args.no_rename_dates:
        all_repl.extend(rename_root_dates(base, dry_run, log))

    if args.move_by_year:
        all_repl.extend(move_root_by_year(base, dry_run, log))

    if (all_repl or substr_pairs) and not dry_run:
        n = fix_all_links(base, all_repl, substr_pairs, dry_run=False)
        print(f"Updated links in {n} files.")
    elif dry_run and (all_repl or substr_pairs):
        print(
            f"[dry-run] would update links ({len(all_repl)} path rewrites, "
            f"{len(substr_pairs)} path prefixes)."
        )

    manifest = base / "_archive" / "reorganize-manifest.json"
    if not dry_run and log:
        manifest.parent.mkdir(parents=True, exist_ok=True)
        manifest.write_text(json.dumps(log, indent=2), encoding="utf-8")
        print(f"Wrote manifest: {manifest.relative_to(base)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
