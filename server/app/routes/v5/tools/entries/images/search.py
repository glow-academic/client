"""Images search — filtered/paginated query against images_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.images.types import SearchImageResponse

MV_NAME = "images_mv"


async def search_images(
    conn: asyncpg.Connection,
    files_id: UUID | None = None,
    quality_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[SearchImageResponse]:
    """Search images from images_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT image_id, files_id, file_path, mime_type, size,
               quality_id, created_at
        FROM {source}
        WHERE ($1::uuid IS NULL OR files_id = $1)
          AND ($2::uuid IS NULL OR quality_id = $2)
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
        """,
        files_id,
        quality_id,
        limit,
        offset,
    )

    return [SearchImageResponse(**dict(r)) for r in rows]
