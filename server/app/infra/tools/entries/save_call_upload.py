"""Save a structured call receipt to disk as a .json file."""

import json
import os
from pathlib import Path
from typing import Any
from uuid import UUID


def save_call_upload(
    call_id: UUID,
    tool_id: UUID,
    arguments: dict[str, Any],
    output: dict[str, Any],
    upload_id: UUID,
    upload_folder: Path,
) -> str:
    """Write a call receipt to {upload_folder}/call/{upload_id}.json.

    The file captures exactly what went in (arguments) and what came out (output).

    Returns the relative file path: call/{upload_id}.json
    """
    subfolder = upload_folder / "call"
    subfolder.mkdir(parents=True, exist_ok=True)

    filename = f"{upload_id}.json"
    full_path = subfolder / filename

    payload = {
        "call_id": str(call_id),
        "tool_id": str(tool_id),
        "arguments": arguments,
        "output": output,
    }

    full_path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")

    return os.path.join("call", filename)
