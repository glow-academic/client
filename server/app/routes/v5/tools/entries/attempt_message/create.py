"""Attempt message CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.attempt_message.types import (
    CreateAttemptMessageResponse,
)


async def create_attempt_message(
    conn: asyncpg.Connection,
    chat_id: UUID,
    message_id: UUID,
    call_id: UUID,
    mcp: bool = False,
) -> CreateAttemptMessageResponse:
    """Create an attempt_message_entry row."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO attempt_message_entry (chat_id, message_id, call_id, mcp, generated)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id
        """,
        chat_id,
        message_id,
        call_id,
        mcp,
    )

    if entry_id is None:
        raise ValueError("Failed to create attempt_message entry")

    return CreateAttemptMessageResponse(id=entry_id)
