"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.file_completion.types import (
    CreateFileCompletionResponse,
)


async def create_file_completion(
    conn: asyncpg.Connection,
    file_id: UUID,
    session_id: UUID,
    stop: bool = False,
    error: bool = False,
    message: str = "",
    mcp: bool = False,
    soft: bool = False,
) -> CreateFileCompletionResponse:
    """Create a file_completion entry."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO file_completion_entry (file_id, session_id, stop, error, message, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING id
        """,
        file_id,
        session_id,
        stop,
        error,
        message,
        not soft,
        mcp,
    )
    return CreateFileCompletionResponse(id=entry_id)
