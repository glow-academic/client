"""Uploads Completions CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.uploads_completions.types import (
    CreateUploadCompletionResponse,
)


async def create_upload_completion(
    conn: asyncpg.Connection,
    upload_id: UUID,
    session_id: UUID,
    mcp: bool = False,
) -> CreateUploadCompletionResponse:
    """Create an uploads_completions entry."""
    completion_id = await conn.fetchval(
        """
        INSERT INTO uploads_completions_entry (upload_id, session_id, mcp, generated)
        VALUES ($1, $2, $3, true)
        RETURNING id
    """,
        upload_id,
        session_id,
        mcp,
    )

    if completion_id is None:
        raise ValueError("Failed to create uploads_completions entry")

    return CreateUploadCompletionResponse(id=completion_id)
