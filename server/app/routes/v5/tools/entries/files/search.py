"""Files search — filtered/paginated query against files_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.files.types import SearchFileResponse

MV_NAME = "files_mv"


async def search_files(
    conn: asyncpg.Connection,
    file_id: UUID | None = None,
    files_id: UUID | None = None,
    mime_type: str | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[SearchFileResponse]:
    """Search files from files_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT file_id, files_id, file_path, mime_type, size, created_at
        FROM {source}
        WHERE ($1::uuid IS NULL OR file_id = $1)
          AND ($2::uuid IS NULL OR files_id = $2)
          AND ($3::text IS NULL OR mime_type = $3)
        ORDER BY created_at DESC
        LIMIT $4 OFFSET $5
        """,
        file_id,
        files_id,
        mime_type,
        limit,
        offset,
    )

    return [SearchFileResponse(**dict(r)) for r in rows]
