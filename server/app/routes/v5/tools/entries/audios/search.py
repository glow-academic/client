"""Audios search — filtered/paginated query against audios_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.audios.types import SearchAudioResponse

MV_NAME = "audios_mv"


async def search_audios(
    conn: asyncpg.Connection,
    files_id: UUID | None = None,
    voice_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[SearchAudioResponse]:
    """Search audios from audios_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT audio_id, files_id, file_path, mime_type, size,
               length_seconds, voice_id, created_at
        FROM {source}
        WHERE ($1::uuid IS NULL OR files_id = $1)
          AND ($2::uuid IS NULL OR voice_id = $2)
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
        """,
        files_id,
        voice_id,
        limit,
        offset,
    )

    return [SearchAudioResponse(**dict(r)) for r in rows]
