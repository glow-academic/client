"""Texts CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.texts.types import CreateTextResponse


async def create_text(
    conn: asyncpg.Connection,
    session_id: UUID,
    mcp: bool = False,
) -> CreateTextResponse:
    """Create a texts entry."""
    text_id = await conn.fetchval("""
        INSERT INTO texts_entry (session_id, mcp, generated)
        VALUES ($1, $2, true)
        RETURNING id
    """, session_id, mcp)

    if text_id is None:
        raise ValueError("Failed to create texts entry")

    return CreateTextResponse(id=text_id)
