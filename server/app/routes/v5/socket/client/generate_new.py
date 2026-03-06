"""Client-facing generate handler (new).

Validates payload, resolves group (no run creation — moved internal),
and emits to internal "generate" event.

Differences from generate.py:
  - No run creation (moved to generate_prepare_new.py)
  - No profiles_runs_connection (moved to generate_prepare_new.py)
  - Uses db_helpers for group resolution
"""

from __future__ import annotations

import uuid
from typing import Any

from app.infra.globals import get_internal_sio, sio
from app.infra.websocket.db_helpers import create_group_for_profile, get_group_from_draft
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.get_db_connection import get_db_connection
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
    """Handle unified ``generate`` event — new version without run creation."""
    artifact_types_raw = data.get("artifact_types") or []
    artifact_type = (
        artifact_types_raw[0]["name"]
        if artifact_types_raw and isinstance(artifact_types_raw[0], dict)
        else "unknown"
    )
    try:
        payload = GeneratePayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await _emit_error(sid, "Profile not found. Please reconnect.", artifact_type)
            return

        profile_id = uuid.UUID(profile_id_str)

        # Resolve group_id (from draft or create new) — no run creation
        group_id: uuid.UUID | None = None
        async with get_db_connection() as conn:
            if payload.draft_id:
                draft_table = f"{artifact_type}_drafts_entry"
                group_id = await get_group_from_draft(conn, draft_table, payload.draft_id)

            if not group_id:
                group_id = await create_group_for_profile(conn, profile_id)

        # Emit to internal bus — run_id will be created in generate_prepare_new
        await internal_sio.emit(
            "generate",
            {
                "sid": sid,
                "profile_id": profile_id_str,
                "group_id": str(group_id),
                # No run_id — created internally now
                **payload.model_dump(mode="json"),
            },
        )
    except Exception as e:
        await _emit_error(sid, f"Invalid request: {str(e)}", artifact_type)
