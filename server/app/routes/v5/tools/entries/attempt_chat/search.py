"""attempt_chat/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    SearchAttemptChatEntriesSqlParams,
    SearchAttemptChatEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/queries/entries/attempt_chat/search_attempt_chat_entries_complete.sql"
)

async def search_attempt_chat_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    attempt_id: UUID | None = None,
    group_id: UUID | None = None,
    attempt_chat_id: UUID | None = None,
    profile_id: UUID | None = None,
    cohort_id: UUID | None = None,
    department_id: UUID | None = None,
    simulation_id: UUID | None = None,
    scenario_id: UUID | None = None,
    user_persona_id: UUID | None = None,
    rubric_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search attempt_chat entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "attempt_chat"]
    cache_key_val = cache_key(
        "/api/v5/entries/attempt_chat/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "attempt_id": str(attempt_id) if attempt_id else None,
            "group_id": str(group_id) if group_id else None,
            "attempt_chat_id": str(attempt_chat_id) if attempt_chat_id else None,
            "profile_id": str(profile_id) if profile_id else None,
            "cohort_id": str(cohort_id) if cohort_id else None,
            "department_id": str(department_id) if department_id else None,
            "simulation_id": str(simulation_id) if simulation_id else None,
            "scenario_id": str(scenario_id) if scenario_id else None,
            "user_persona_id": str(user_persona_id) if user_persona_id else None,
            "rubric_id": str(rubric_id) if rubric_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return list(cached.get("items", []))

    params = SearchAttemptChatEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        attempt_id=attempt_id,
        group_id=group_id,
        attempt_chat_id=attempt_chat_id,
        profile_id=profile_id,
        cohort_id=cohort_id,
        department_id=department_id,
        simulation_id=simulation_id,
        scenario_id=scenario_id,
        user_persona_id=user_persona_id,
        rubric_id=rubric_id,
    )
    result = cast(
        SearchAttemptChatEntriesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items
