#!/usr/bin/env python3
"""
Finder helper: call an OpenAI-compatible Chat Completions API on selected files.
Modes via LLM_MODE: summarize | caption | improve | commit
Config: env OPENAI_API_KEY, or ~/.config/sidekick/openai_api_key, or source llm.env from wrapper.
"""
from __future__ import annotations

import base64
import json
import mimetypes
import os
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path

# Defaults (override with LLM_API_BASE, LLM_MODEL)
DEFAULT_BASE = "https://api.openai.com/v1"
DEFAULT_MODEL = "gpt-4o-mini"
MAX_TEXT_CHARS = 200_000
MAX_IMAGE_BYTES = 25 * 1024 * 1024

MODES: dict[str, dict[str, str]] = {
    "summarize": {
        "system": "You help the user understand documents. Be concise and accurate.",
        "instruction": (
            "Summarize the following document. Use short sections with bullets for key points. "
            "If the content looks like a log, focus on errors and notable events."
        ),
    },
    "caption": {
        "system": "You describe images clearly for accessibility and notes.",
        "instruction": (
            "Give a short caption for this image. Then list any readable text you can see (OCR-style), "
            "or say there is no readable text."
        ),
    },
    "improve": {
        "system": "You improve writing while preserving meaning and facts.",
        "instruction": (
            "Improve the following text for clarity, grammar, and flow. Preserve meaning. "
            "Output only the revised text, no preamble."
        ),
    },
    "commit": {
        "system": "You write Git commit messages following Conventional Commits when appropriate.",
        "instruction": (
            "Read this diff or patch and write a Git commit message. "
            "Use a short subject line (≤72 chars) plus a blank line and optional body with details. "
            "Output only the commit message text."
        ),
    },
}


def notify(title: str, text: str) -> None:
    text = text.replace('"', '\\"')
    title = title.replace('"', '\\"')
    os.system(f'/usr/bin/osascript -e \'display notification "{text}" with title "{title}"\' 2>/dev/null')


def load_api_key() -> str | None:
    k = os.environ.get("OPENAI_API_KEY") or os.environ.get("LLM_API_KEY")
    if k:
        return k.strip()
    p = Path.home() / ".config" / "sidekick" / "openai_api_key"
    if p.is_file():
        return p.read_text(encoding="utf-8", errors="replace").strip()
    return None


def guess_mime(path: Path) -> str:
    mt, _ = mimetypes.guess_type(str(path))
    if mt:
        return mt
    ext = path.suffix.lower()
    if ext in {".md", ".markdown"}:
        return "text/markdown"
    if ext in {".diff", ".patch"}:
        return "text/plain"
    return "application/octet-stream"


def is_probably_image(mime: str) -> bool:
    return mime.startswith("image/")


def read_text_file(path: Path) -> str:
    data = path.read_text(encoding="utf-8", errors="replace")
    if len(data) > MAX_TEXT_CHARS:
        data = data[:MAX_TEXT_CHARS] + "\n\n[…truncated by finder_llm.py]"
    return data


def read_image_b64(path: Path) -> tuple[str, str]:
    raw = path.read_bytes()
    if len(raw) > MAX_IMAGE_BYTES:
        raise ValueError(f"Image too large ({len(raw)} bytes). Max {MAX_IMAGE_BYTES}.")
    mime = guess_mime(path)
    if not is_probably_image(mime):
        mime = "image/png"
    b64 = base64.standard_b64encode(raw).decode("ascii")
    return mime, b64


def chat_completion(
    api_key: str,
    base: str,
    model: str,
    messages: list[dict],
    timeout: int = 180,
) -> str:
    url = base.rstrip("/") + "/chat/completions"
    body = {
        "model": model,
        "messages": messages,
        "temperature": float(os.environ.get("LLM_TEMPERATURE", "0.3")),
    }
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    try:
        return payload["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"Unexpected API response: {payload!r}") from e


def run_mode(mode: str, path: Path, api_key: str, base: str, model: str) -> Path:
    if mode not in MODES:
        raise ValueError(f"Unknown LLM_MODE: {mode}")

    meta = MODES[mode]
    system = meta["system"]
    instruction = meta["instruction"]
    mime = guess_mime(path)

    if mode == "caption":
        if not is_probably_image(mime):
            raise ValueError("Not an image — use “Summarize” or “Improve writing” for text files.")
        mt, b64 = read_image_b64(path)
        user_content: list[dict] | str = [
            {"type": "text", "text": instruction},
            {
                "type": "image_url",
                "image_url": {"url": f"data:{mt};base64,{b64}"},
            },
        ]
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ]
    else:
        if is_probably_image(mime):
            raise ValueError("This action is for text files — use “Caption image with LLM” for images.")
        text = read_text_file(path)
        user_body = f"{instruction}\n\n---\n\n{text}"
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_body},
        ]

    result = chat_completion(api_key, base, model, messages)
    suffix = {"summarize": "summary", "improve": "improved", "commit": "commitmsg"}.get(mode, mode)
    out = path.parent / f"{path.stem}.llm-{suffix}.txt"
    out.write_text(result + "\n", encoding="utf-8")
    return out


def main() -> int:
    mode = os.environ.get("LLM_MODE", "summarize").strip().lower()
    if mode not in MODES:
        print(f"Invalid LLM_MODE: {mode}", file=sys.stderr)
        return 2

    api_key = load_api_key()
    if not api_key:
        notify("LLM", "Set OPENAI_API_KEY or ~/.config/sidekick/openai_api_key")
        print(
            "Missing API key. Set OPENAI_API_KEY, create ~/.config/sidekick/openai_api_key, "
            "or put keys in ~/.config/sidekick/llm.env",
            file=sys.stderr,
        )
        return 127

    base = os.environ.get("LLM_API_BASE", DEFAULT_BASE).strip()
    model = os.environ.get("LLM_MODEL", DEFAULT_MODEL).strip()

    paths = [Path(p).expanduser().resolve() for p in sys.argv[1:]]
    if not paths:
        print("Usage: finder_llm.py <file> [files…]", file=sys.stderr)
        return 2

    errors = 0
    for path in paths:
        if not path.is_file():
            print(f"Skip (not a file): {path}", file=sys.stderr)
            continue
        try:
            out = run_mode(mode, path, api_key, base, model)
            print(f"Wrote {out}", file=sys.stderr)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace") if e.fp else ""
            print(f"HTTP {e.code}: {err_body[:500]}", file=sys.stderr)
            errors += 1
        except Exception as e:
            print(f"{path}: {e}", file=sys.stderr)
            errors += 1

    if errors == 0:
        notify("LLM", f"Done ({mode}).")
    else:
        notify("LLM", "Some files failed — see Terminal.")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
