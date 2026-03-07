"""Texts CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.texts.types import CreateTextResponse


async def create_text(
    conn: asyncpg.Connection,
    session_id: UUID,
    *,
    id: UUID | None = None,
    mcp: bool = False,
    soft: bool = False,
) -> CreateTextResponse:
    """Create a texts entry."""
    text_id = await conn.fetchval(
        """
        INSERT INTO texts_entry (id, session_id, active, mcp, generated)
        VALUES (COALESCE($4, uuidv7()), $1, $2, $3, true)
        RETURNING id
    """,
        session_id,
        not soft,
        mcp,
        id,
    )

    if text_id is None:
        raise ValueError("Failed to create texts entry")

    return CreateTextResponse(id=text_id)
