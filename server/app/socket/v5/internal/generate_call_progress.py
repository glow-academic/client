"""Handle generate_call_progress — tool call arguments streaming delta.

Currently a placeholder. Future: could emit attempt-specific tool call
progress events for live argument preview, etc.
"""

from typing import Any

from app.infra.globals import get_internal_sio

internal_sio = get_internal_sio()


@internal_sio.on("generate_call_progress")  # type: ignore
async def handle_call_progress(data: dict[str, Any]) -> None:
    pass
