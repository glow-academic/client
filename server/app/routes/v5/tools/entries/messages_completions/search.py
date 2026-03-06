"""Messages completions search — filtered/paginated query against messages_completions_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.messages_completions.types import (
    GetMessagesCompletionResponse,
)

MV_NAME = "messages_completions_mv"


async def search_messages_completions(
    conn: asyncpg.Connection,
    message_ids: list[UUID] | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetMessagesCompletionResponse]:
    """Search messages_completions from messages_completions_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT id, message_id, session_id, created_at, active, mcp, generated
        FROM {source}
        WHERE ($1::uuid[] IS NULL OR message_id = ANY($1))
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """,
        message_ids,
        limit,
        offset,
    )

    return [GetMessagesCompletionResponse(**dict(r)) for r in rows]
