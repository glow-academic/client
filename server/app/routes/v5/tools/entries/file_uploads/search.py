"""File Uploads SEARCH — declarative filters."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.file_uploads.types import GetFileUploadResponse


async def search_file_uploads(
    conn: asyncpg.Connection,
    file_id: UUID | None = None,
    upload_id: UUID | None = None,
    session_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[GetFileUploadResponse]:
    """Search file_uploads entries with declarative filters."""
    rows = await conn.fetch(
        """
        SELECT id, file_id, upload_id, session_id, created_at, active, mcp, generated
        FROM file_uploads_entry
        WHERE active = true
          AND ($1::uuid IS NULL OR file_id = $1)
          AND ($2::uuid IS NULL OR upload_id = $2)
          AND ($3::uuid IS NULL OR session_id = $3)
        ORDER BY created_at DESC
        LIMIT $4 OFFSET $5
        """,
        file_id,
        upload_id,
        session_id,
        limit,
        offset,
    )
    return [
        GetFileUploadResponse(
            id=r["id"],
            file_id=r["file_id"],
            upload_id=r["upload_id"],
            session_id=r["session_id"],
            created_at=r["created_at"],
            active=r["active"],
            mcp=r["mcp"],
            generated=r["generated"],
        )
        for r in rows
    ]
