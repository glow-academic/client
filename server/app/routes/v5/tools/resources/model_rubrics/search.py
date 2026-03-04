"""model_rubrics/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetModelRubricsV4Item,
    SearchModelRubricsSqlParams,
    SearchModelRubricsSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/model_rubrics/search_model_rubrics_complete.sql"


async def search_model_rubrics_internal(
    conn: asyncpg.Connection,
    model_ids: list[UUID],
    rubric_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    eval: bool = False,
) -> list[QGetModelRubricsV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        model_ids: List of model IDs to search rubrics for
        bypass_cache: Whether to bypass cache

    Returns:
        List of available model rubric items
    """
    # Generate cache key
    cache_key_val = cache_key(
        "model_rubrics/search",
        {
            "model_ids": sorted([str(id) for id in model_ids]),
            "rubric_ids": sorted(str(i) for i in (rubric_ids or [])),
            "eval": eval,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetModelRubricsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = SearchModelRubricsSqlParams(
        model_ids=model_ids or [],
        rubric_ids=rubric_ids or [],
        eval=eval,
    )
    result = cast(
        SearchModelRubricsSqlRow,
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
        tags=["model_rubrics"],
        redis=get_redis_client(),
    )

    return items
