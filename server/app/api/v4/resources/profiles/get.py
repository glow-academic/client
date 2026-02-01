"""Profiles get endpoint - v4 API.

Provides batch get endpoint for fetching profiles by IDs.
"""

from typing import cast
from uuid import UUID

import asyncpg
from pydantic import BaseModel

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/profiles/get_profiles_complete.sql"


# =============================================================================
# Batch Types
# =============================================================================


class QGetProfilesV4Item(BaseModel):
    """Profile item from batch SQL query."""

    profile_id: UUID | None = None
    name: str | None = None


class GetProfilesSqlParams(BaseModel):
    """SQL parameters for batch get_profiles."""

    p_ids: list[UUID]


class GetProfilesSqlRow(BaseModel):
    """SQL result row for batch."""

    items: list[QGetProfilesV4Item] | None = None


# =============================================================================
# Internal Functions
# =============================================================================


async def get_profiles_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetProfilesV4Item]:
    """Internal function for batch fetching profiles by IDs.

    Args:
        conn: Database connection
        ids: List of profile IDs to fetch
        bypass_cache: Whether to bypass cache

    Returns:
        List of profile items
    """
    if not ids:
        return []

    tags = ["resources", "profiles"]
    cache_key_val = cache_key(
        "/api/v4/resources/profiles/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetProfilesV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetProfilesSqlParams(p_ids=ids)
    result = cast(
        GetProfilesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetProfilesV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items
