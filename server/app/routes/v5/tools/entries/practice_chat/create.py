"""Practice chat CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.practice_chat.types import CreatePracticeChatResponse


async def create_practice_chat(
    conn: asyncpg.Connection,
    practice_id: UUID,
    chat_id: UUID,
    session_id: UUID,
    mcp: bool = False,
    soft: bool = False,
) -> CreatePracticeChatResponse:
    """Create a practice_chat_entry bridge row."""
    row_id = await conn.fetchval(
        """
        INSERT INTO practice_chat_entry (practice_id, chat_id, session_id, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id
        """,
        practice_id,
        chat_id,
        session_id,
        not soft,
        mcp,
    )

    if row_id is None:
        raise ValueError("Failed to create practice_chat_entry")

    return CreatePracticeChatResponse(id=row_id)
