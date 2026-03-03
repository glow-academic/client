"""flags/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetFlagsV4Item,
    SearchFlagsSqlParams,
    SearchFlagsSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/flags/search_flags_complete.sql"

async def search_flags_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    flag_type: str | None = None,
    bypass_cache: bool = False,
    *,
    agent: bool = False,
    auth: bool = False,
    cohort: bool = False,
    department: bool = False,
    document: bool = False,
    eval: bool = False,
    field: bool = False,
    model: bool = False,
    parameter: bool = False,
    persona: bool = False,
    profile: bool = False,
    provider: bool = False,
    rubric: bool = False,
    scenario: bool = False,
    setting: bool = False,
    simulation: bool = False,
    tool: bool = False,
) -> list[QGetFlagsV4Item]:
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "flags"]
    cache_key_val = cache_key(
        "/api/v5/resources/flags/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "flag_type": flag_type,
            "agent": agent,
            "auth": auth,
            "cohort": cohort,
            "department": department,
            "document": document,
            "eval": eval,
            "field": field,
            "model": model,
            "parameter": parameter,
            "persona": persona,
            "profile": profile,
            "provider": provider,
            "rubric": rubric,
            "scenario": scenario,
            "setting": setting,
            "simulation": simulation,
            "tool": tool,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetFlagsV4Item.model_validate(item) for item in cached.get("items", [])
            ]

    params = SearchFlagsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        flag_type=flag_type,
        agent=agent,
        auth=auth,
        cohort=cohort,
        department=department,
        document=document,
        eval=eval,
        field=field,
        model=model,
        parameter=parameter,
        persona=persona,
        profile=profile,
        provider=provider,
        rubric=rubric,
        scenario=scenario,
        setting=setting,
        simulation=simulation,
        tool=tool,
    )
    result = cast(
        SearchFlagsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetFlagsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items
