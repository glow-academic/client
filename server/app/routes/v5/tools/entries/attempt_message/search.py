"""attempt_message/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    SearchAttemptMessageEntriesSqlParams,
    SearchAttemptMessageEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/attempt_message/search_attempt_message_entries_complete.sql"

async def search_attempt_message_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    chat_id: UUID | None = None,
    attempt_id: UUID | None = None,
    runs_id: UUID | None = None,
    text_id: UUID | None = None,
    audio_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search attempt_message entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "attempt_message"]
    cache_key_val = cache_key(
        "/api/v5/entries/attempt_message/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "chat_id": str(chat_id) if chat_id else None,
            "attempt_id": str(attempt_id) if attempt_id else None,
            "runs_id": str(runs_id) if runs_id else None,
            "text_id": str(text_id) if text_id else None,
            "audio_id": str(audio_id) if audio_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchAttemptMessageEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        chat_id=chat_id,
        attempt_id=attempt_id,
        runs_id=runs_id,
        text_id=text_id,
        audio_id=audio_id,
    )
    result = cast(
        SearchAttemptMessageEntriesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
    )

    return items
