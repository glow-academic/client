"""Client-facing generate handler.

Validates the client payload, creates group + run, and emits to
the internal "generate" event. Config creation lives in internal/generate.py.
"""

import uuid
from typing import Any

from app.infra.globals import get_internal_sio, get_pool, get_redis_client, sio
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.infra.websocket.get_db_connection import get_db_connection
from app.infra.websocket.typed_emit import emit_to_internal
from app.socket.v5.client.types import GeneratePayload
from app.socket.v5.types import GenerateErrorApiRequest
from app.tools.entries.groups.create import create_group
from app.tools.entries.runs.create import create_run
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


async def _emit_error(
    sid: str,
    message: str,
    artifact_type: str,
) -> None:
    """Emit a generation error via the internal bus."""
    await emit_to_internal(
        "generate_call_error",
        GenerateErrorApiRequest(
            sid=sid,
            error_message=message,
            artifact_type=artifact_type,
            resource_type=artifact_type,
        ),
        sid=sid,
    )


@sio.event  # type: ignore
async def generate(sid: str, data: dict[str, Any]) -> None:
    """Handle unified ``generate`` event (client-to-server).

    Creates group + run, then emits to internal bus for processing.
    """
    # Derive artifact_type from artifact_types[0].name
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
            await _emit_error(
                sid,
                "Profile not found. Please reconnect.",
                artifact_type,
            )
            return

        profile_id = uuid.UUID(profile_id_str)

        session_id_str = await find_session_by_socket(sid)
        if not session_id_str:
            await _emit_error(
                sid,
                "Session not found. Please reconnect.",
                artifact_type,
            )
            return

        session_id = uuid.UUID(session_id_str)
        identity = await resolve_profile_identity_context(
            get_pool(),
            profile_id,
            get_redis_client(),
            session_id=session_id,
            draft_id=payload.draft_id,
            artifact_type=artifact_type,
        )
        if identity is None:
            await _emit_error(
                sid,
                "Profile context could not be resolved.",
                artifact_type,
            )
            return

        group_id = identity.group_id
        profiles_id = identity.profiles_id
        if group_id is None:
            async with get_db_connection() as conn:
                group_id = (await create_group(conn, session_id=session_id)).id

        # Canonical prepare: group + run
        async with get_db_connection() as conn:
            run_id = (
                await create_run(
                    conn,
                    group_id=group_id,
                    session_id=session_id,
                    profiles_id=profiles_id,
                )
            ).id

        await internal_sio.emit(
            "generate",
            {
                "sid": sid,
                "profile_id": profile_id_str,
                **payload.model_dump(mode="json"),
                "run_id": str(run_id),
                "group_id": str(group_id),
            },
        )
    except Exception as e:
        await _emit_error(
            sid,
            f"Invalid request: {str(e)}",
            artifact_type,
        )
