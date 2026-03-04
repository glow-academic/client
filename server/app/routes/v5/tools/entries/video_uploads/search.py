"""Video Uploads SEARCH — declarative filters."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.video_uploads.types import GetVideoUploadResponse


async def search_video_uploads(
    conn: asyncpg.Connection,
    video_id: UUID | None = None,
    upload_id: UUID | None = None,
    session_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[GetVideoUploadResponse]:
    """Search video_uploads entries with declarative filters."""
    rows = await conn.fetch(
        """
        SELECT id, video_id, upload_id, session_id, created_at, active, mcp, generated
        FROM video_uploads_entry
        WHERE active = true
          AND ($1::uuid IS NULL OR video_id = $1)
          AND ($2::uuid IS NULL OR upload_id = $2)
          AND ($3::uuid IS NULL OR session_id = $3)
        ORDER BY created_at DESC
        LIMIT $4 OFFSET $5
        """,
        video_id,
        upload_id,
        session_id,
        limit,
        offset,
    )
    return [
        GetVideoUploadResponse(
            id=r["id"],
            video_id=r["video_id"],
            upload_id=r["upload_id"],
            session_id=r["session_id"],
            created_at=r["created_at"],
            active=r["active"],
            mcp=r["mcp"],
            generated=r["generated"],
        )
        for r in rows
    ]
