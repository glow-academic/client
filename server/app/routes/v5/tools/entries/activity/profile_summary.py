"""activity/profile_summary internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetProfileSummaryViewSqlParams,
    GetProfileSummaryViewSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

PROFILE_SUMMARY_SQL_PATH = (
    "app/sql/queries/views/activity/profile_summary/"
    "get_profile_summary_view_complete.sql"
)

async def get_profile_summary_view_internal(
    conn: asyncpg.Connection,
    profile_id_filter: UUID | None = None,
    bypass_cache: bool = False,
) -> GetProfileSummaryViewSqlRow:
    """Fetch per-profile aggregate counts from MVs."""
    cache_key_val = cache_key(
        "views/activity/profile_summary/get",
        {"profile_id_filter": str(profile_id_filter) if profile_id_filter else None},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetProfileSummaryViewSqlRow.model_validate(cached)

    params = GetProfileSummaryViewSqlParams(profile_id_filter=profile_id_filter)
    result = cast(
        GetProfileSummaryViewSqlRow,
        await execute_sql_typed(conn, PROFILE_SUMMARY_SQL_PATH, params=params),
    )

    response = GetProfileSummaryViewSqlRow(
        items=list(result.items) if result and result.items else [],
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "activity", "profile_summary"],
    )

    return response
