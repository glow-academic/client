"""Uploads completions search — filtered/paginated query against uploads_completions_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.uploads_completions.types import (
    SearchUploadCompletionResponse,
)

MV_NAME = "uploads_completions_mv"


async def search_uploads_completions(
    conn: asyncpg.Connection,
    upload_ids: list[UUID] | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[SearchUploadCompletionResponse]:
    """Search uploads_completions from uploads_completions_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT id, created_at, generated, mcp, active, upload_id, session_id
        FROM {source}
        WHERE ($1::uuid[] IS NULL OR upload_id = ANY($1))
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """,
        upload_ids,
        limit,
        offset,
    )

    return [SearchUploadCompletionResponse(**dict(r)) for r in rows]
