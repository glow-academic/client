"""Home chat search — filtered/paginated query against home_chat_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.home_chat.types import GetHomeChatResponse

MV_NAME = "home_chat_mv"


async def search_home_chats(
    conn: asyncpg.Connection,
    home_id: UUID | None = None,
    chat_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetHomeChatResponse]:
    """Search home_chat entries from home_chat_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT id, home_id, chat_id, created_at, active, generated, mcp, session_id
        FROM {source}
        WHERE ($1::uuid IS NULL OR home_id = $1)
          AND ($2::uuid IS NULL OR chat_id = $2)
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
        """,
        home_id,
        chat_id,
        limit,
        offset,
    )

    return [GetHomeChatResponse(**dict(r)) for r in rows]
