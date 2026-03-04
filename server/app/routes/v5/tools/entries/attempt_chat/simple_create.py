"""Attempt chat CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.attempt_chat.types import CreateAttemptChatResponse


async def create_attempt_chat(
    conn: asyncpg.Connection,
    call_id: UUID,
    group_id: UUID,
    attempt_id: UUID,
    session_id: UUID,
    chat_id: UUID | None = None,
    assistant_persona_ids: list[UUID] | None = None,
    position: int = 0,
    time_limit: int | None = None,
    mcp: bool = False,
) -> CreateAttemptChatResponse:
    """Create an attempt_chat entry with bridge to attempt.

    Also creates the attempt_chat_bridge_entry row.
    """
    attempt_chat_id = await conn.fetchval(
        """
        INSERT INTO attempt_chat_entry (
            call_id, group_id, chat_id, "position", time_limit,
            assistant_persona_ids, mcp, generated
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING id
        """,
        call_id,
        group_id,
        chat_id,
        position,
        time_limit,
        assistant_persona_ids or [],
        mcp,
    )

    if attempt_chat_id is None:
        raise ValueError("Failed to create attempt_chat entry")

    # Bridge: attempt ↔ attempt_chat
    await conn.execute(
        """
        INSERT INTO attempt_chat_bridge_entry (attempt_id, attempt_chat_id, session_id, generated)
        VALUES ($1, $2, $3, true)
        """,
        attempt_id,
        attempt_chat_id,
        session_id,
    )

    return CreateAttemptChatResponse(id=attempt_chat_id)
