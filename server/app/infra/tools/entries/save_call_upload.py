"""Save call data to disk as a .json file."""

import json
import os
from pathlib import Path
from typing import Any
from uuid import UUID


def save_call_upload(data: dict[str, Any], upload_id: UUID, upload_folder: Path) -> str:
    """Write call data to {upload_folder}/call/{upload_id}.json.

    Returns the relative file path: call/{upload_id}.json
    """
    subfolder = upload_folder / "call"
    subfolder.mkdir(parents=True, exist_ok=True)

    filename = f"{upload_id}.json"
    full_path = subfolder / filename

    full_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

    return os.path.join("call", filename)
