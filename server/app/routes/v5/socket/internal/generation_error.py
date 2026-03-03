"""Handle generation errors — pass through to generation_channel.

Replaces ALL v4 error.py files. Listens on generate_call_error and
generate_text_error, re-emits as generation_channel(type=error).
"""

from typing import Any

from app.globals import get_internal_sio
from app.routes.v5.socket.internal.generation_types import GenerationErrorData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("generate_call_error")  # type: ignore
@internal_sio.on("generate_text_error")  # type: ignore
async def handle_generation_error(data: dict[str, Any]) -> None:
    """Re-emit generation errors to generation_channel for the server layer."""
    sid = data.get("sid", "")
    if not sid:
        return

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during generation"
    )

    await internal_sio.emit(
        "generation_channel",
        GenerationErrorData(
            sid=sid,
            artifact_type=data.get("artifact_type", "unknown"),
            group_id=data.get("group_id"),
            resource_type=data.get("resource_type"),
            resource_types=data.get("resource_types"),
            resource_id=data.get("resource_id"),
            run_id=data.get("run_id"),
            message=error_message,
        ).model_dump(mode="json"),
    )
