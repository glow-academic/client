"""Client-facing generate handler (new).

Validates payload, resolves profile_id + session_id from sid,
and emits to internal "generate" event.

Differences from generate.py:
  - No run creation (moved to generate_prepare_new.py)
  - No profiles_runs_connection (moved to generate_prepare_new.py)
  - Resolves both profile_id AND session_id from sid (not from payload)
  - group_id always assumed present in payload (no resolution needed)
  - session_id, profile_id, group_id propagate through all internal events
"""

from __future__ import annotations

from typing import Any

from app.infra.globals import get_internal_sio, sio
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.infra.websocket.typed_emit import emit_to_internal
from app.routes.v5.socket.client.types import GeneratePayload
from app.routes.v5.socket.types import GenerateErrorApiRequest
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


async def _emit_error(sid: str, message: str, artifact_type: str) -> None:
    await emit_to_internal(
        "generate_call_error",
        GenerateErrorApiRequest(
            sid=sid, error_message=message,
            artifact_type=artifact_type, resource_type=artifact_type,
        ),
        sid=sid,
    )


# NOTE: Not registered as @sio.event yet — use side-by-side with generate.py
# To activate: import this module in __init__.py and swap the registration.
async def generate_new(sid: str, data: dict[str, Any]) -> None:
    """Handle unified ``generate`` event — new version.

    Resolves profile_id and session_id from sid (client boundary),
    then forwards everything to the internal "generate" event.
    group_id is always expected in the payload.
    """
    artifact_types_raw = data.get("artifact_types") or []
    artifact_type = (
        artifact_types_raw[0]["name"]
        if artifact_types_raw and isinstance(artifact_types_raw[0], dict)
        else "unknown"
    )
    try:
        payload = GeneratePayload(**data)

        # Resolve profile_id from sid (never trust payload)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await _emit_error(sid, "Profile not found. Please reconnect.", artifact_type)
            return

        # Resolve session_id from sid (stored at connect time)
        session_id_str = await find_session_by_socket(sid)
        if not session_id_str:
            await _emit_error(sid, "Session not found. Please reconnect.", artifact_type)
            return

        # group_id must be in payload — no resolution needed
        group_id = data.get("group_id")
        if not group_id:
            await _emit_error(sid, "group_id is required.", artifact_type)
            return

        # Emit to internal bus with resolved identity context
        # run_id will be created in generate_prepare_new
        await internal_sio.emit(
            "generate",
            {
                "sid": sid,
                "profile_id": profile_id_str,
                "session_id": session_id_str,
                "group_id": group_id,
                **payload.model_dump(mode="json"),
            },
        )
    except Exception as e:
        await _emit_error(sid, f"Invalid request: {str(e)}", artifact_type)
