"""Message Uploads CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.message_uploads.types import CreateMessageUploadResponse


async def create_message_upload(
    conn: asyncpg.Connection,
    message_id: UUID,
    upload_id: UUID,
    session_id: UUID,
    mcp: bool = False,
) -> CreateMessageUploadResponse:
    """Create a message_uploads entry."""
    row_id = await conn.fetchval("""
        INSERT INTO message_uploads_entry (message_id, upload_id, session_id, mcp, generated)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id
    """, message_id, upload_id, session_id, mcp)

    if row_id is None:
        raise ValueError("Failed to create message_uploads entry")

    return CreateMessageUploadResponse(id=row_id)
