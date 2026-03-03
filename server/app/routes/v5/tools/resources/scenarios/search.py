"""scenarios/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.api.main.simulation.types import (
    QGetScenariosV4Item,
    SearchScenariosSqlRow,
)
from app.sql.types import SearchScenariosSqlParams
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/scenarios/search_scenarios_complete.sql"

async def search_scenarios_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    department_ids: list[UUID] | None = None,
    suggest_source: str | None = None,
    exclude_ids: list[UUID] | None = None,
    persona_ids: list[UUID] | None = None,
    parameter_ids: list[UUID] | None = None,
    problem_statement_enabled: bool | None = None,
    objectives_enabled: bool | None = None,
    video_enabled: bool | None = None,
    images_enabled: bool | None = None,
    questions_enabled: bool | None = None,
    bypass_cache: bool = False,
    *,
    scenario: bool = False,
    simulation: bool = False,
) -> list[QGetScenariosV4Item]:
    """Internal function to search scenarios.

    Args:
        conn: Database connection
        search: Search term
        limit_count: Maximum number of results
        offset_count: Offset for pagination
        department_ids: User's department IDs for filtering
        suggest_source: Source for suggestions ('all', 'linked', 'recent')
        exclude_ids: IDs to exclude from results
        bypass_cache: Whether to bypass cache

    Returns:
        List of scenario items
    """
    tags = ["resources", "scenarios"]
    cache_key_val = cache_key(
        "/api/v5/resources/scenarios/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "department_ids": [str(i) for i in department_ids]
            if department_ids
            else None,
            "suggest_source": suggest_source,
            "exclude_ids": [str(i) for i in exclude_ids] if exclude_ids else None,
            "persona_ids": sorted(str(i) for i in (persona_ids or [])),
            "parameter_ids": sorted(str(i) for i in (parameter_ids or [])),
            "problem_statement_enabled": problem_statement_enabled,
            "objectives_enabled": objectives_enabled,
            "video_enabled": video_enabled,
            "images_enabled": images_enabled,
            "questions_enabled": questions_enabled,
            "scenario": scenario,
            "simulation": simulation,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached and "items" in cached:
            return [
                QGetScenariosV4Item.model_validate(item) for item in cached["items"]
            ]

    params = SearchScenariosSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        department_ids=department_ids or [],
        suggest_source=suggest_source,
        exclude_ids=exclude_ids or [],
        persona_ids=persona_ids or [],
        parameter_ids=parameter_ids or [],
        problem_statement_enabled=problem_statement_enabled,
        objectives_enabled=objectives_enabled,
        video_enabled=video_enabled,
        images_enabled=images_enabled,
        questions_enabled=questions_enabled,
        scenario=scenario,
        simulation=simulation,
    )

    result = cast(
        SearchScenariosSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items = result.items or []

    # Cache the result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items
