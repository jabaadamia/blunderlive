from __future__ import annotations

import os
from pathlib import Path


def load_key(*, content_env_var: str, path_env_var: str) -> str:
    content = os.environ.get(content_env_var)
    if content:
        return content.replace("\\n", "\n")

    path = os.environ.get(path_env_var)
    if path:
        return Path(path).read_text(encoding="utf-8")

    raise RuntimeError(f"Neither {content_env_var} nor {path_env_var} is set")
