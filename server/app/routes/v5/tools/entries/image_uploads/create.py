"""Image Uploads CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.image_uploads.types import CreateImageUploadResponse


async def create_image_upload(
    conn: asyncpg.Connection,
    image_id: UUID,
    upload_id: UUID,
    mcp: bool = False,
) -> CreateImageUploadResponse:
    """Create an image_uploads entry."""
    row_id = await conn.fetchval("""
        INSERT INTO image_uploads_entry (image_id, upload_id, mcp, generated)
        VALUES ($1, $2, $3, true)
        RETURNING id
    """, image_id, upload_id, mcp)

    if row_id is None:
        raise ValueError("Failed to create image_uploads entry")

    return CreateImageUploadResponse(id=row_id)
