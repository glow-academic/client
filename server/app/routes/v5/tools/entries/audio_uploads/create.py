"""Audio Uploads CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.audio_uploads.types import CreateAudioUploadResponse


async def create_audio_upload(
    conn: asyncpg.Connection,
    audio_id: UUID,
    upload_id: UUID,
    mcp: bool = False,
) -> CreateAudioUploadResponse:
    """Create an audio_uploads entry."""
    row_id = await conn.fetchval("""
        INSERT INTO audio_uploads_entry (audio_id, upload_id, mcp, generated)
        VALUES ($1, $2, $3, true)
        RETURNING id
    """, audio_id, upload_id, mcp)

    if row_id is None:
        raise ValueError("Failed to create audio_uploads entry")

    return CreateAudioUploadResponse(id=row_id)
