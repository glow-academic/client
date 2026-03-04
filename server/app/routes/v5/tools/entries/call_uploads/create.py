"""Call Uploads CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.call_uploads.types import CreateCallUploadResponse


async def create_call_upload(
    conn: asyncpg.Connection,
    call_id: UUID,
    upload_id: UUID,
    mcp: bool = False,
) -> CreateCallUploadResponse:
    """Create a call_uploads entry."""
    row_id = await conn.fetchval("""
        INSERT INTO call_uploads_entry (call_id, upload_id, mcp, generated)
        VALUES ($1, $2, $3, true)
        RETURNING id
    """, call_id, upload_id, mcp)

    if row_id is None:
        raise ValueError("Failed to create call_uploads entry")

    return CreateCallUploadResponse(id=row_id)
