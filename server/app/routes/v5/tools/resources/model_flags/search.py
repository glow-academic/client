"""model_flags/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetModelFlagsV4Item,
    SearchModelFlagsSqlParams,
    SearchModelFlagsSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/model_flags/search_model_flags_complete.sql"

async def search_model_flags_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    model_ids: list[UUID] | None = None,
    flag_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    eval: bool = False,
) -> list[QGetModelFlagsV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        search: Text search filter
        limit_count: Max results to return
        offset_count: Offset for pagination
        exclude_ids: IDs to exclude from results
        model_ids: List of model IDs to search flags for (empty = all models)
        bypass_cache: Whether to bypass cache

    Returns:
        List of available model flag items
    """
    effective_model_ids = model_ids or []
    effective_exclude_ids = exclude_ids or []

    # Generate cache key
    cache_key_val = cache_key(
        "model_flags/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": sorted(str(i) for i in effective_exclude_ids),
            "model_ids": sorted(str(i) for i in effective_model_ids),
            "flag_ids": sorted(str(i) for i in (flag_ids or [])),
            "eval": eval,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetModelFlagsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = SearchModelFlagsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=effective_exclude_ids,
        model_ids=effective_model_ids,
        flag_ids=flag_ids or [],
        eval=eval,
    )
    result = cast(
        SearchModelFlagsSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH,
            params=params,
        ),
    )

    items = result.items or []

    # Cache response
    await set_cached(
        cache_key_val,
        {"data": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["model_flags"],
    )

    return items
