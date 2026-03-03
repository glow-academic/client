"""profile_personas/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetProfilePersonasV4Item,
    SearchProfilePersonasSqlParams,
    SearchProfilePersonasSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/queries/resources/profile_personas/search_profile_personas_complete.sql"
)

async def search_profile_personas_internal(
    conn: asyncpg.Connection,
    profile_ids: list[UUID],
    persona_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    cohort: bool = False,
) -> list[QGetProfilePersonasV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        profile_ids: List of profile IDs to search personas for
        bypass_cache: Whether to bypass cache

    Returns:
        List of available profile persona items
    """
    # Generate cache key
    cache_key_val = cache_key(
        "profile_personas/search",
        {
            "profile_ids": sorted([str(id) for id in profile_ids]),
            "persona_ids": sorted(str(i) for i in (persona_ids or [])),
            "cohort": cohort,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetProfilePersonasV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = SearchProfilePersonasSqlParams(
        profile_ids=profile_ids or [],
        persona_ids=persona_ids or [],
        cohort=cohort,
    )
    result = cast(
        SearchProfilePersonasSqlRow,
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
        tags=["profile_personas"],
    )

    return items
