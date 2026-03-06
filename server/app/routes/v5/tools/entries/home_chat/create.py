"""Home chat CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.home_chat.types import CreateHomeChatResponse


async def create_home_chat(
    conn: asyncpg.Connection,
    home_id: UUID,
    chat_id: UUID,
    session_id: UUID,
    mcp: bool = False,
    soft: bool = False,
) -> CreateHomeChatResponse:
    """Create a home_chat_entry bridge row."""
    row_id = await conn.fetchval(
        """
        INSERT INTO home_chat_entry (home_id, chat_id, session_id, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id
        """,
        home_id,
        chat_id,
        session_id,
        not soft,
        mcp,
    )

    if row_id is None:
        raise ValueError("Failed to create home_chat_entry")

    return CreateHomeChatResponse(id=row_id)
