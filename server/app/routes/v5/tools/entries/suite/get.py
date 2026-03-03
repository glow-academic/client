"""suite/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetSuiteEntriesSqlParams,
    GetSuiteEntriesSqlRow,
    GetSuiteViewSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/suite/get_suite_entries_complete.sql"

VIEW_SQL_PATH = "app/sql/queries/views/benchmark/bundle/get_suite_view_complete.sql"

async def get_suite_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch suite entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "suite"]
    cache_key_val = cache_key(
        "/api/v5/entries/suite/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetSuiteEntriesSqlParams(ids=ids)
    result = cast(
        GetSuiteEntriesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
    )

    return items

async def get_suite_view_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    suite_entry_id: UUID,
) -> GetSuiteViewSqlRow:
    """Thin MV-backed bundle scope lookup used by benchmark artifacts."""
    from app.sql.types import GetSuiteViewSqlParams

    params = GetSuiteViewSqlParams(
        profile_id_filter=profile_id,
        suite_entry_id_filter=suite_entry_id,
    )
    row = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    if not row:
        return GetSuiteViewSqlRow()

    return GetSuiteViewSqlRow(
        profile_has_access=row.profile_has_access or False,
        suite_entry_id=row.suite_entry_id,
        benchmark_id=row.benchmark_id,
        department_ids=list(row.department_ids or []),
        model_ids=list(row.model_ids or []),
        prompt_ids=list(row.prompt_ids or []),
        instruction_ids=list(row.instruction_ids or []),
        voice_ids=list(row.voice_ids or []),
        temperature_level_ids=list(row.temperature_level_ids or []),
        reasoning_level_ids=list(row.reasoning_level_ids or []),
        tool_ids=list(row.tool_ids or []),
        key_ids=list(row.key_ids or []),
        flag_ids=list(row.flag_ids or []),
        name_ids=list(row.name_ids or []),
        description_ids=list(row.description_ids or []),
    )
