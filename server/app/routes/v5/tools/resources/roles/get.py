"""roles/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.api.resources.roles.types import (
    GetRolesSqlParams,
    GetRolesSqlRow,
    QGetRolesV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/roles/get_roles_complete.sql"

async def get_roles_internal(
    conn: asyncpg.Connection,
    ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> list[QGetRolesV4Item]:
    """Internal function to fetch roles by IDs (empty/None = all).

    Can be called directly from other routes without HTTP overhead.
    """
    effective_ids = ids or []
    if not effective_ids:
        return []
    tags = ["resources", "roles"]
    cache_key_val = cache_key(
        "/api/v5/resources/roles/get",
        {"ids": sorted(str(i) for i in effective_ids)},
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetRolesV4Item.model_validate(item) for item in cached.get("items", [])
            ]

    # Execute SQL
    params = GetRolesSqlParams(ids=effective_ids)
    result = cast(
        GetRolesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetRolesV4Item] = (
        [
            QGetRolesV4Item.model_validate(
                item.model_dump() if hasattr(item, "model_dump") else item
            )
            for item in (result.items or [])
        ]
        if result
        else []
    )

    # Cache result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=300,  # Roles change infrequently, cache longer
        tags=tags,
    )

    return items
