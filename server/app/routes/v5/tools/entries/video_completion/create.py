"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.video_completion.types import (
    CreateVideoCompletionResponse,
)


async def create_video_completion(
    conn: asyncpg.Connection,
    video_id: UUID,
    session_id: UUID,
    stop: bool = False,
    error: bool = False,
    message: str = "",
    mcp: bool = False,
    soft: bool = False,
) -> CreateVideoCompletionResponse:
    """Create a video_completion entry."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO video_completion_entry (video_id, session_id, stop, error, message, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING id
        """,
        video_id,
        session_id,
        stop,
        error,
        message,
        not soft,
        mcp,
    )
    return CreateVideoCompletionResponse(id=entry_id)
