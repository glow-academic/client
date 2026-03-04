"""practice_chat/get — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.practice_chat.types import GetPracticeChatResponse
from app.sql.types import (
    GetPracticeChatEntriesSqlParams,
    GetPracticeChatEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

MV_NAME = "practice_chat_mv"

SQL_PATH = (
    "app/sql/queries/entries/practice_chat/get_practice_chat_entries_complete.sql"
)


async def get_practice_chats(
    conn: asyncpg.Connection,
    ids: list[UUID],
) -> list[GetPracticeChatResponse]:
    """Get practice_chat entries by IDs from practice_chat_mv."""
    if not ids:
        return []

    rows = await conn.fetch(
        f"""
        SELECT id, practice_id, chat_id, created_at, active, generated, mcp, session_id
        FROM {MV_NAME}
        WHERE id = ANY($1)
        """,
        ids,
    )

    return [
        GetPracticeChatResponse(
            id=r["id"],
            practice_id=r["practice_id"],
            chat_id=r["chat_id"],
            created_at=r["created_at"],
            active=r["active"],
            generated=r["generated"],
            mcp=r["mcp"],
            session_id=r["session_id"],
        )
        for r in rows
    ]


async def get_practice_chat_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch practice_chat entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "practice_chat"]
    cache_key_val = cache_key(
        "/api/v5/entries/practice_chat/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    params = GetPracticeChatEntriesSqlParams(ids=ids)
    result = cast(
        GetPracticeChatEntriesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items
