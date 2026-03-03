"""personas/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetPersonaResourceSqlParams,
    GetPersonaResourceSqlRow,
    GetPersonasSqlParams,
    GetPersonasSqlRow,
    QGetPersonaResourceV4Item,
    QGetPersonasV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/personas/get_persona_resource_data_complete.sql"

BATCH_SQL_PATH = "app/sql/queries/resources/personas/get_personas_complete.sql"

async def get_persona_internal(
    conn: asyncpg.Connection,
    id: UUID,
    bypass_cache: bool = False,
) -> QGetPersonaResourceV4Item | None:
    """Internal function for fetching a single persona.

    Args:
        conn: Database connection
        id: Persona ID to fetch
        bypass_cache: Whether to bypass cache

    Returns:
        Persona item or None if not found
    """
    cache_key_val = cache_key("personas/get", {"id": str(id)})

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            item_data = cached.get("data")
            if item_data:
                return QGetPersonaResourceV4Item.model_validate(item_data)
            return None

    params = GetPersonaResourceSqlParams(id=id)
    result = cast(
        GetPersonaResourceSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items = result.items if result and result.items else []
    item = items[0] if items else None

    await set_cached(
        cache_key_val,
        {"data": item.model_dump(mode="json") if item else None},
        ttl=60,
        tags=["personas"],
    )

    return item

async def get_personas_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetPersonasV4Item]:
    """Internal function for batch fetching personas by IDs.

    This is a simple fetch without active flag check, used by scenario GET.

    Args:
        conn: Database connection
        ids: List of persona IDs to fetch
        bypass_cache: Whether to bypass cache

    Returns:
        List of persona items (may be fewer than requested if some don't exist)
    """
    if not ids:
        return []

    tags = ["resources", "personas"]
    cache_key_val = cache_key(
        "/api/v5/resources/personas/get-batch",
        {"ids": [str(id) for id in ids]},
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetPersonasV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    # Execute SQL
    params = GetPersonasSqlParams(p_ids=ids)
    result = cast(
        GetPersonasSqlRow,
        await execute_sql_typed(conn, BATCH_SQL_PATH, params=params),
    )

    items: list[QGetPersonasV4Item] = result.items if result and result.items else []

    # Cache result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items
