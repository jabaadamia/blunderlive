from __future__ import annotations

from pathlib import Path


def load_key(*, content: str | None, path: str | None) -> str:
    if content:
        return content.replace("\\n", "\n")

    if path:
        return Path(path).read_text(encoding="utf-8")

    raise RuntimeError("Neither JWT key content nor JWT key path is set")
