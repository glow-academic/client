"""sessions/timeline internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetSessionTimelineViewSqlParams,
    GetSessionTimelineViewSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

TIMELINE_SQL_PATH = (
    "app/sql/queries/views/session/timeline/get_session_timeline_view_complete.sql"
)


async def get_session_timeline_view_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    bypass_cache: bool = False,
) -> GetSessionTimelineViewSqlRow:
    """Fetch unified event timeline for a single session."""
    cache_key_val = cache_key(
        "views/session/timeline/get",
        {"session_id": str(session_id)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return GetSessionTimelineViewSqlRow.model_validate(cached)

    params = GetSessionTimelineViewSqlParams(session_id_filter=session_id)
    result = cast(
        GetSessionTimelineViewSqlRow,
        await execute_sql_typed(conn, TIMELINE_SQL_PATH, params=params),
    )

    response = GetSessionTimelineViewSqlRow(
        items=list(result.items) if result and result.items else [],
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "session", "timeline"],
        redis=get_redis_client(),
    )

    return response
