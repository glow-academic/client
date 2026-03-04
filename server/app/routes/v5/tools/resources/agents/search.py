"""agents/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetAgentsV4Item,
    SearchAgentsSqlParams,
    SearchAgentsSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/agents/search_agents_complete.sql"

async def search_agents_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    tool_ids: list[UUID] | None = None,
    instruction_ids: list[UUID] | None = None,
    model_ids: list[UUID] | None = None,
    prompt_ids: list[UUID] | None = None,
    quality: str | None = None,
    bypass_cache: bool = False,
    *,
    agent: bool = False,
    setting: bool = False,
) -> list[QGetAgentsV4Item]:
    """Internal function to search agents."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "agents"]
    cache_key_val = cache_key(
        "/api/v5/resources/agents/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "department_ids": sorted(str(i) for i in (department_ids or [])),
            "tool_ids": sorted(str(i) for i in (tool_ids or [])),
            "instruction_ids": sorted(str(i) for i in (instruction_ids or [])),
            "model_ids": sorted(str(i) for i in (model_ids or [])),
            "prompt_ids": sorted(str(i) for i in (prompt_ids or [])),
            "quality": quality,
            "agent": agent,
            "setting": setting,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetAgentsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchAgentsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        department_ids=department_ids or [],
        tool_ids=tool_ids or [],
        instruction_ids=instruction_ids or [],
        model_ids=model_ids or [],
        prompt_ids=prompt_ids or [],
        quality=quality,
        agent=agent,
        setting=setting,
    )
    result = cast(
        SearchAgentsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetAgentsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items
