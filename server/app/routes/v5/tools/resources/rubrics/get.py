"""rubrics/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetRubricsBatchSqlParams,
    GetRubricsBatchSqlRow,
    GetRubricsSqlParams,
    GetRubricsSqlRow,
    QGetRubricsBatchV4Item,
    QGetRubricsV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/rubrics/get_rubrics_complete.sql"

BATCH_SQL_PATH = "app/sql/queries/resources/rubrics/get_rubrics_batch_complete.sql"

async def get_rubrics_batch_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetRubricsBatchV4Item]:
    """Internal function for batch fetching rubrics by IDs.

    Args:
        conn: Database connection
        ids: List of rubric IDs to fetch
        bypass_cache: Whether to bypass cache

    Returns:
        List of rubric items
    """
    if not ids:
        return []

    tags = ["resources", "rubrics"]
    cache_key_val = cache_key(
        "/api/v5/resources/rubrics/get-batch",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetRubricsBatchV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetRubricsBatchSqlParams(p_ids=ids)
    result = cast(
        GetRubricsBatchSqlRow,
        await execute_sql_typed(conn, BATCH_SQL_PATH, params=params),
    )

    items: list[QGetRubricsBatchV4Item] = (
        result.items if result and result.items else []
    )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items

async def get_rubrics_internal(
    conn: asyncpg.Connection,
    ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> list[QGetRubricsV4Item]:
    """Internal function for parallel fetching rubrics by IDs.

    Args:
        conn: Database connection
        ids: List of rubric IDs to fetch (empty/None returns all rubrics)
        bypass_cache: Whether to bypass cache

    Returns:
        List of rubric items
    """
    effective_ids = ids or []

    # Generate cache key
    cache_key_val = cache_key(
        "rubrics/get",
        {
            "ids": sorted([str(id) for id in effective_ids])
            if effective_ids
            else ["__all__"]
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetRubricsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = GetRubricsSqlParams(ids=effective_ids)
    result = cast(
        GetRubricsSqlRow,
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
        tags=["rubrics"],
    )

    return items
