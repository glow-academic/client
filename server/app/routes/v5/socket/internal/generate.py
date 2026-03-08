"""Rate limit gate for the generation pipeline.

Handles: @internal_sio.on("generate") — the canonical entrypoint for all
generation requests (from client handlers and audio continuation).

Pipeline position:
  "generate" → generate.py (this file, rate limit gate)
    → "generate_prepare" → generate_prepare.py (fetch, render, dispatch)
      → "generate_artifact" → generate_artifact.py (token factory)
        → "generate_run_complete" → generate_complete.py (pricing, save, cleanup)

For audio session continuations (detected by existing session on group_id),
the gate rotates the run_id on the session without emitting "generate_prepare"
— the session is already live.
"""

import uuid
from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.session_store import get_session_by_group_id, rotate_run_id
from app.routes.v5.socket.client.types import GeneratePayload
from app.routes.v5.socket.types import GenerateErrorApiRequest
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


async def _emit_error(
    sid: str,
    message: str,
    artifact_type: str,
    *,
    group_id: str | None = None,
) -> None:
    await internal_sio.emit(
        "generate_error",
        GenerateErrorApiRequest(
            sid=sid,
            error_message=message,
            artifact_type=artifact_type,
            group_id=group_id,
        ).model_dump(),
    )


@internal_sio.on("generate")  # type: ignore
async def generate_handler(data: dict[str, Any]) -> None:
    """Rate limit gate — forwards to generate_prepare.

    For audio continuations (existing session on group_id), rotates run_id
    on the session without re-entering the full generation pipeline.
    """
    sid = data.get("sid", "")

    # Derive artifact_type from artifact_types[0].name (canonical path)
    artifact_types_raw = data.get("artifact_types") or []
    artifact_type = (
        artifact_types_raw[0]["name"]
        if artifact_types_raw and isinstance(artifact_types_raw[0], dict)
        else "unknown"
    )

    if not sid:
        return

    profile_id_str = data.get("profile_id") or await find_profile_by_socket(sid)
    if not profile_id_str:
        await _emit_error(sid, "Profile not found. Please reconnect.", artifact_type)
        return

    try:
        uuid.UUID(profile_id_str)
        GeneratePayload(**data)
    except Exception as e:
        await _emit_error(sid, f"Invalid request: {str(e)}", artifact_type)
        return

    group_id = data.get("group_id")

    # Check if this is an audio session continuation (existing session on group_id)
    if group_id:
        session = get_session_by_group_id(group_id)
        if session:
            # Audio continuation — rotate run_id, don't re-enter generation pipeline
            new_run_id = str(uuid.uuid4())
            rotate_run_id(session, new_run_id)

            logger.info(
                f"Audio session continuation - group_id={group_id}, "
                f"new_run_id={new_run_id}"
            )
            return

    # Normal generation — forward to generate_prepare
    await internal_sio.emit("generate_prepare", data)
