"""File Uploads CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.file_uploads.types import CreateFileUploadResponse


async def create_file_upload(
    conn: asyncpg.Connection,
    file_id: UUID,
    upload_id: UUID,
    mcp: bool = False,
) -> CreateFileUploadResponse:
    """Create a file_uploads entry."""
    row_id = await conn.fetchval("""
        INSERT INTO file_uploads_entry (file_id, upload_id, mcp, generated)
        VALUES ($1, $2, $3, true)
        RETURNING id
    """, file_id, upload_id, mcp)

    if row_id is None:
        raise ValueError("Failed to create file_uploads entry")

    return CreateFileUploadResponse(id=row_id)
