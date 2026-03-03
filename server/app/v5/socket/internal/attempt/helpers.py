"""Shared helpers for attempt handlers (proceed)."""

from __future__ import annotations

import uuid

from app.auth.access import get_access_internal
from app.v5.api.entries.groups.create import create_groups_entry_internal
from app.v5.api.entries.runs.create import create_runs_entry_internal
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.infra.websocket.get_db_connection import get_db_connection
from app.globals import get_internal_sio
from app.v5.socket.internal.attempt.types import GenerateRequestData


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

    # Resolve session_id + profiles_id, then create group + run
    session_id_str = await find_session_by_socket(sid)
    session_id = uuid.UUID(session_id_str) if session_id_str else None

    async with get_db_connection() as conn:
        access = await get_access_internal(conn, profile_id)
        profiles_id = access.profiles_id

        group_result = await create_groups_entry_internal(
            conn,
            session_id=session_id,
        )
        group_id = group_result.id

        run_result = await create_runs_entry_internal(
            conn,
            session_id=session_id,
            group_id=group_id,
            profiles_id=profiles_id,
        )
        run_id = run_result.id

    await internal_sio.emit(
        "generate",
        GenerateRequestData(
            sid=sid,
            profile_id=str(profile_id),
            artifact_types=[{"name": "chat", "operation": "get"}],
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
