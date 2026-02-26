"""Shared helpers for attempt handlers (proceed)."""

from __future__ import annotations

import uuid

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v5.internal.attempt.types import GenerateRequestData


async def emit_chat_generate(
    sid: str,
    profile_id: uuid.UUID,
    attempt_id: uuid.UUID,
    chat_entry_id: uuid.UUID,
    department_id: uuid.UUID,
    attempt_chat_id: uuid.UUID | None,
    draft_id: uuid.UUID | None = None,
    resource_types: list[str] | None = None,
    user_instructions: list[str] | None = None,
    save: bool = True,
) -> None:
    """Create run + profile-run link, then emit to generate pipeline.

    Config creation is handled canonically by internal/generate.py.
    """
    internal_sio = get_internal_sio()
    resolved_resource_types = resource_types or [
        "personas",
        "scenarios",
        "parameters",
        "fields",
    ]

    # Create group + run + profile-run link
    async with get_db_connection() as conn:
        group_id = await conn.fetchval(
            """INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (NOW(), NOW(), (
                SELECT id FROM sessions_entry
                WHERE profile_id = $1 AND active = true
                ORDER BY created_at DESC LIMIT 1
            )) RETURNING id""",
            profile_id,
        )

        run_id = await conn.fetchval(
            """INSERT INTO runs_entry (group_id)
            VALUES ($1) RETURNING id""",
            group_id,
        )

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
        GenerateRequestData(
            sid=sid,
            profile_id=str(profile_id),
            artifact_type="chat",
            artifact_id=str(chat_entry_id),
            draft_id=str(draft_id) if draft_id else None,
            resource_types=resolved_resource_types,
            user_instructions=user_instructions,
            save=save,
            run_id=str(run_id),
            group_id=str(group_id),
            metadata={
                "attempt_id": str(attempt_id),
                "attempt_chat_id": str(attempt_chat_id) if attempt_chat_id else None,
            },
        ).model_dump(mode="json"),
    )
