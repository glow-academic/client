"""objectives/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.api.resources.objectives.types import (
    GetObjectiveSqlParams,
    GetObjectiveSqlRow,
    GetObjectiveV4Item,
)
from app.sql.types import (
    GetObjectivesSqlParams,
    GetObjectivesSqlRow,
    QGetObjectivesV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/objectives/get_objective_complete.sql"

BATCH_SQL_PATH = "app/sql/queries/resources/objectives/get_objectives_complete.sql"

async def get_objective_internal(
    conn: asyncpg.Connection,
    id: UUID,
    bypass_cache: bool = False,
) -> GetObjectiveV4Item | None:
    """Internal function for fetching a single objective."""
    cache_key_val = cache_key("objectives/get", {"id": str(id)})

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            item_data = cached.get("data")
            if item_data:
                return GetObjectiveV4Item.model_validate(item_data)
            return None

    params = GetObjectiveSqlParams(id=id)
    result = cast(
        GetObjectiveSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items = result.items if result and result.items else []
    item = items[0] if items else None

    await set_cached(
        cache_key_val,
        {"data": item.model_dump(mode="json") if item else None},
        ttl=60,
        tags=["objectives"],
        redis=get_redis_client(),
    )

    return item

async def get_objectives_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetObjectivesV4Item]:
    """Internal function for batch fetching objectives by IDs.

    This is a simple fetch without active flag check, used by scenario GET.
    """
    if not ids:
        return []

    tags = ["resources", "objectives"]
    cache_key_val = cache_key(
        "/api/v5/resources/objectives/get-batch",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetObjectivesV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetObjectivesSqlParams(p_ids=ids)
    result = cast(
        GetObjectivesSqlRow,
        await execute_sql_typed(conn, BATCH_SQL_PATH, params=params),
    )

    items: list[QGetObjectivesV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items
