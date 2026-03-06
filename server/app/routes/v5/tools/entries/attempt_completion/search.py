"""Attempt completion search — filtered/paginated query against attempt_completion_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.attempt_completion.types import (
    GetAttemptCompletionResponse,
)

MV_NAME = "attempt_completion_mv"


async def search_attempt_completions(
    conn: asyncpg.Connection,
    chat_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetAttemptCompletionResponse]:
    """Search attempt_completion entries from attempt_completion_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT id, chat_id, end_reason, created_at, active, generated, mcp, call_id
        FROM {source}
        WHERE ($1::uuid IS NULL OR chat_id = $1)
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """,
        chat_id,
        limit,
        offset,
    )

    return [GetAttemptCompletionResponse(**dict(r)) for r in rows]
