"""responses/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    SearchResponsesEntriesSqlParams,
    SearchResponsesEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/responses/search_responses_entries_complete.sql"

async def search_responses_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    chat_id: UUID | None = None,
    question_id: UUID | None = None,
    option_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search responses entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "responses"]
    cache_key_val = cache_key(
        "/api/v5/entries/responses/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "chat_id": str(chat_id) if chat_id else None,
            "question_id": str(question_id) if question_id else None,
            "option_id": str(option_id) if option_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchResponsesEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        chat_id=chat_id,
        question_id=question_id,
        option_id=option_id,
    )
    result = cast(
        SearchResponsesEntriesSqlRow,
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
