"""Videos search — filtered/paginated query against videos_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.videos.types import SearchVideoResponse

MV_NAME = "videos_mv"


async def search_videos(
    conn: asyncpg.Connection,
    video_id: UUID | None = None,
    videos_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[SearchVideoResponse]:
    """Search videos from videos_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT video_id, videos_id, file_path, mime_type, size, length_seconds, created_at
        FROM {source}
        WHERE ($1::uuid IS NULL OR video_id = $1)
          AND ($2::uuid IS NULL OR videos_id = $2)
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
        """,
        video_id,
        videos_id,
        limit,
        offset,
    )

    return [SearchVideoResponse(**dict(r)) for r in rows]
