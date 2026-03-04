"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.attempt_highlight.types import (
    CreateAttemptHighlightResponse,
)


async def create_attempt_highlight(
    conn: asyncpg.Connection,
    strength_id: UUID,
    call_id: UUID,
    section: str,
    idx: int = 0,
    mcp: bool = False,
) -> CreateAttemptHighlightResponse:
    """Create an attempt_highlight entry."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO attempt_highlight_entry (strength_id, call_id, section, idx, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id
        """,
        strength_id,
        call_id,
        section,
        idx,
        mcp,
    )
    return CreateAttemptHighlightResponse(id=entry_id)
