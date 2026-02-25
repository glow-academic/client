"""Shared helpers for attempt handlers (proceed, generation_complete)."""

from __future__ import annotations

import uuid
from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.main import get_internal_sio
from app.socket.v5.internal.attempt.types import GenerateRequestData
from app.sql.types import CreateAttemptChatSqlParams, CreateAttemptChatSqlRow
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH_CREATE_CHAT = (
    "app/sql/v4/queries/generate/attempt/create_attempt_chat_complete.sql"
)


async def link_attempt_chat(
    conn: asyncpg.Connection,
    profile_id: UUID,
    attempt_id: UUID,
    attempt_chat_id: UUID,
) -> UUID | None:
    """Create attempt_chat_entry linking attempt to attempt_chat, refresh MVs."""
    chat_row = cast(
        CreateAttemptChatSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH_CREATE_CHAT,
            params=CreateAttemptChatSqlParams(
                p_profile_id=profile_id,
                p_attempt_id=attempt_id,
                p_attempt_chat_id=attempt_chat_id,
            ),
        ),
    )

    if not chat_row or not chat_row.chat_id:
        return None

    await conn.execute("REFRESH MATERIALIZED VIEW attempt_mv")
    await conn.execute("REFRESH MATERIALIZED VIEW attempt_chat_mv")
    await invalidate_tags(["attempt", "attempts"])

    return chat_row.chat_id


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
    """Compose with generate by emitting to the internal bus."""
    internal_sio = get_internal_sio()
    resolved_resource_types = resource_types or [
        "personas",
        "scenarios",
        "parameters",
        "fields",
    ]

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
            attempt_id=str(attempt_id),
            attempt_chat_id=str(attempt_chat_id) if attempt_chat_id else None,
        ).model_dump(mode="json"),
    )
