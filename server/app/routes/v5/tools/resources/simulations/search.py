"""simulations/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.api.resources.simulations.types import (
    GetSimulationsV4Item,
    SearchSimulationsSqlRow,
)
from app.sql.types import SearchSimulationsSqlParams
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/simulations/search_simulations_complete.sql"

async def search_simulations_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    draft_id: UUID | None = None,
    suggest_source: str | None = "all",
    exclude_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    scenario_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    cohort: bool = False,
    simulation: bool = False,
) -> list[GetSimulationsV4Item]:
    """Internal function for searching simulations.

    Args:
        conn: Database connection
        search: Search term to filter by name/description
        limit_count: Maximum number of results
        offset_count: Offset for pagination
        draft_id: Optional draft ID for filtering by draft connection
        suggest_source: Source for suggestions ('all', 'linked', 'draft')
        exclude_ids: IDs to exclude from results
        bypass_cache: Whether to bypass cache

    Returns:
        List of simulation items
    """
    # Generate cache key
    cache_key_val = cache_key(
        "simulations/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "draft_id": str(draft_id) if draft_id else None,
            "suggest_source": suggest_source,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "department_ids": sorted(str(i) for i in (department_ids or [])),
            "scenario_ids": sorted(str(i) for i in (scenario_ids or [])),
            "cohort": cohort,
            "simulation": simulation,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                GetSimulationsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = SearchSimulationsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        draft_id=draft_id,
        suggest_source=suggest_source,
        exclude_ids=exclude_ids or [],
        department_ids=department_ids or [],
        scenario_ids=scenario_ids or [],
        cohort=cohort,
        simulation=simulation,
    )

    result = cast(
        SearchSimulationsSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH,
            params=params,
        ),
    )

    # Convert auto-generated Q* types to handcrafted types via dict roundtrip
    items: list[GetSimulationsV4Item] = [
        GetSimulationsV4Item.model_validate(
            item.model_dump() if hasattr(item, "model_dump") else item
        )
        for item in (result.items or [])
    ]

    # Cache response
    await set_cached(
        cache_key_val,
        {"data": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["simulations"],
    )

    return items
