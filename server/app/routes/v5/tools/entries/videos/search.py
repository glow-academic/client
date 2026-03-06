"""Videos search — filtered/paginated query against videos_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.videos.types import SearchVideoResponse

MV_NAME = "videos_mv"


async def search_videos(
    conn: asyncpg.Connection,
    files_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[SearchVideoResponse]:
    """Search videos from videos_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT video_id, files_id, file_path, mime_type, size, length_seconds, created_at
        FROM {source}
        WHERE ($1::uuid IS NULL OR files_id = $1)
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """,
        files_id,
        limit,
        offset,
    )

    return [SearchVideoResponse(**dict(r)) for r in rows]
