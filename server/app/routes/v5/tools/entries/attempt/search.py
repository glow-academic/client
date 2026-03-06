"""attempt/search — filtered/paginated query against attempt_mv."""

from datetime import datetime
from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.infra.globals import get_redis_client
from app.routes.v5.tools.entries.attempt.types import GetAttemptResponse
from app.sql.types import (
    GetAttemptListViewSqlRow,
    QGetAttemptListViewV4Option,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

MV_NAME = "attempt_mv"


async def search_attempts(
    conn: asyncpg.Connection,
    simulation_id: UUID | None = None,
    profile_id: UUID | None = None,
    cohort_id: UUID | None = None,
    department_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetAttemptResponse]:
    """Search attempt entries from attempt_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT attempt_id, simulation_id, profile_id, user_persona_id,
               personas_id, cohort_id, department_id, practice,
               attempt_created_at, infinite_mode, num_chats, is_archived,
               scenario_ids, chat_entry_id, attempt_chat_id
        FROM {source}
        WHERE ($1::uuid IS NULL OR simulation_id = $1)
          AND ($2::uuid IS NULL OR profile_id = $2)
          AND ($3::uuid IS NULL OR cohort_id = $3)
          AND ($4::uuid IS NULL OR department_id = $4)
        ORDER BY attempt_created_at DESC
        LIMIT $5 OFFSET $6
        """,
        simulation_id,
        profile_id,
        cohort_id,
        department_id,
        limit,
        offset,
    )

    return [GetAttemptResponse(**dict(r)) for r in rows]


LIST_SQL_PATH = "app/sql/queries/views/attempt/list/get_attempt_list_view_complete.sql"


async def get_attempt_list_internal(
    conn: asyncpg.Connection,
    attempt_ids: list[UUID] | None = None,
    profile_id_filter: UUID | None = None,
    simulation_id_filter: UUID | None = None,
    practice_filter: bool | None = None,
    is_archived_filter: bool | None = None,
    cohort_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    scenario_ids_filter: list[UUID] | None = None,
    infinite_mode_filter: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetAttemptListViewSqlRow:
    """Internal function for fetching attempt data."""
    from app.sql.types import GetAttemptListViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt/list/get",
        {
            "attempt_ids": [str(a) for a in attempt_ids] if attempt_ids else None,
            "profile_id_filter": str(profile_id_filter) if profile_id_filter else None,
            "simulation_id_filter": str(simulation_id_filter)
            if simulation_id_filter
            else None,
            "practice_filter": practice_filter,
            "is_archived_filter": is_archived_filter,
            "cohort_ids": [str(c) for c in cohort_ids] if cohort_ids else None,
            "department_ids": [str(d) for d in department_ids]
            if department_ids
            else None,
            "scenario_ids_filter": [str(s) for s in scenario_ids_filter]
            if scenario_ids_filter
            else None,
            "infinite_mode_filter": infinite_mode_filter,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return GetAttemptListViewSqlRow.model_validate(cached)

    params = GetAttemptListViewSqlParams(
        attempt_ids=attempt_ids,
        profile_id_filter=profile_id_filter,
        simulation_id_filter=simulation_id_filter,
        practice_filter=practice_filter,
        is_archived_filter=is_archived_filter,
        cohort_ids=cohort_ids,
        department_ids=department_ids,
        scenario_ids_filter=scenario_ids_filter,
        infinite_mode_filter=infinite_mode_filter,
        date_from=date_from or datetime.min,
        date_to=date_to or datetime.max,
        sort_by_field=sort_by,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, LIST_SQL_PATH, params=params)

    # Filter out options with empty values
    simulation_options: list[QGetAttemptListViewV4Option] | None = None
    if result and result.simulation_options:
        simulation_options = [opt for opt in result.simulation_options if opt.value]

    scenario_options: list[QGetAttemptListViewV4Option] | None = None
    if result and result.scenario_options:
        scenario_options = [opt for opt in result.scenario_options if opt.value]

    profile_options: list[QGetAttemptListViewV4Option] | None = None
    if result and result.profile_options:
        profile_options = [opt for opt in result.profile_options if opt.value]

    response = GetAttemptListViewSqlRow(
        items=result.items if result else None,
        total_count=result.total_count or 0 if result else 0,
        simulation_options=simulation_options,
        scenario_options=scenario_options,
        profile_options=profile_options,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["entries", "attempt", "list"],
        redis=get_redis_client(),
    )

    return response
