"""Message Uploads GET — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.message_uploads.types import GetMessageUploadResponse


async def get_message_upload(
    conn: asyncpg.Connection,
    message_upload_id: UUID,
) -> GetMessageUploadResponse | None:
    """Get a message_uploads entry by ID."""
    row = await conn.fetchrow("""
        SELECT id, message_id, upload_id,
               created_at, active, mcp, generated
        FROM message_uploads_entry
        WHERE id = $1
    """, message_upload_id)

    if row is None:
        return None

    return GetMessageUploadResponse(
        id=row["id"],
        message_id=row["message_id"],
        upload_id=row["upload_id"],
        created_at=row["created_at"],
        active=row["active"],
        mcp=row["mcp"],
        generated=row["generated"],
    )
