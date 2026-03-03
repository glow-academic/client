"""Client-facing generate handler.

Validates the client payload, creates group + run, and emits to
the internal "generate" event. Config creation lives in internal/generate.py.
"""

import uuid
from typing import Any

from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.get_db_connection import get_db_connection
from app.infra.websocket.typed_emit import emit_to_internal
from app.globals import get_internal_sio, sio
from app.v5.socket.client.types import GeneratePayload
from app.v5.socket.types import GenerateErrorApiRequest
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

        # Canonical prepare: group + run + profile-run link
        async with get_db_connection() as conn:
            # 1. Resolve group_id from draft or create new
            group_id: uuid.UUID | None = None
            if payload.draft_id:
                draft_table = f"{artifact_type}_drafts_entry"
                group_id = await conn.fetchval(
                    f"SELECT group_id FROM {draft_table} WHERE id = $1",  # noqa: S608
                    payload.draft_id,
                )

            if not group_id:
                group_id = await conn.fetchval(
                    """INSERT INTO groups_entry (created_at, updated_at, session_id)
                    VALUES (NOW(), NOW(), (
                        SELECT id FROM sessions_entry
                        WHERE profile_id = $1 AND active = true
                        ORDER BY created_at DESC LIMIT 1
                    )) RETURNING id""",
                    profile_id,
                )

            # 2. Create run
            run_id = await conn.fetchval(
                """INSERT INTO runs_entry (group_id)
                VALUES ($1) RETURNING id""",
                group_id,
            )

            # 3. Profile-run link
            await conn.execute(
                """INSERT INTO profiles_runs_connection (profiles_id, run_id)
                SELECT ppj.profiles_id, $2
                FROM profile_profiles_junction ppj
                WHERE ppj.profile_id = $1
                LIMIT 1""",
                profile_id,
                run_id,
            )

        await internal_sio.emit(
            "generate",
            {
                "sid": sid,
                "profile_id": profile_id_str,
                "run_id": str(run_id),
                "group_id": str(group_id),
                **payload.model_dump(mode="json"),
            },
        )
    except Exception as e:
        await _emit_error(
            sid,
            f"Invalid request: {str(e)}",
            artifact_type,
        )
