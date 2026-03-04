"""Text Uploads CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.text_uploads.types import CreateTextUploadResponse


async def create_text_upload(
    conn: asyncpg.Connection,
    text_id: UUID,
    upload_id: UUID,
    mcp: bool = False,
) -> CreateTextUploadResponse:
    """Create a text_uploads entry."""
    row_id = await conn.fetchval("""
        INSERT INTO text_uploads_entry (text_id, upload_id, mcp, generated)
        VALUES ($1, $2, $3, true)
        RETURNING id
    """, text_id, upload_id, mcp)

    if row_id is None:
        raise ValueError("Failed to create text_uploads entry")

    return CreateTextUploadResponse(id=row_id)
