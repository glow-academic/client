"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.attempt_replacement.types import (
    CreateAttemptReplacementResponse,
)


async def create_attempt_replacement(
    conn: asyncpg.Connection,
    improvement_id: UUID,
    call_id: UUID,
    section: str,
    replace: str,
    idx: int = 0,
    mcp: bool = False,
) -> CreateAttemptReplacementResponse:
    """Create an attempt_replacement entry."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO attempt_replacement_entry (improvement_id, call_id, section, "replace", idx, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING id
        """,
        improvement_id,
        call_id,
        section,
        replace,
        idx,
        mcp,
    )
    return CreateAttemptReplacementResponse(id=entry_id)
