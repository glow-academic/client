"""Attempt list entries (migrated from views/attempt/list)."""

from datetime import datetime
from uuid import UUID

import asyncpg

from app.api.v4.entries.attempt.types import (
    AttemptFilterOption,
    AttemptViewItem,
    GetAttemptsResponse,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/attempt/list/get_attempt_list_view_complete.sql"


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
) -> GetAttemptsResponse:
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
        cached = await get_cached(cache_key_val)
        if cached:
            return GetAttemptsResponse.model_validate(cached)

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

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[AttemptViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                AttemptViewItem(
                    attempt_id=item.attempt_id,
                    simulation_id=item.simulation_id,
                    profile_id=item.profile_id,
                    cohort_id=item.cohort_id,
                    department_id=item.department_id,
                    practice=item.practice or False,
                    infinite_mode=item.infinite_mode or False,
                    created_at=item.created_at,
                    is_archived=item.is_archived or False,
                    scenario_ids=list(item.scenario_ids) if item.scenario_ids else None,
                )
            )

    simulation_options: list[AttemptFilterOption] | None = None
    if result and result.simulation_options:
        simulation_options = [
            AttemptFilterOption(
                value=opt.value or "",
                label=opt.label or "",
                count=opt.count or 0,
            )
            for opt in result.simulation_options
            if opt.value
        ]

    scenario_options: list[AttemptFilterOption] | None = None
    if result and result.scenario_options:
        scenario_options = [
            AttemptFilterOption(
                value=opt.value or "",
                label=opt.label or "",
                count=opt.count or 0,
            )
            for opt in result.scenario_options
            if opt.value
        ]

    profile_options: list[AttemptFilterOption] | None = None
    if result and result.profile_options:
        profile_options = [
            AttemptFilterOption(
                value=opt.value or "",
                label=opt.label or "",
                count=opt.count or 0,
            )
            for opt in result.profile_options
            if opt.value
        ]

    response = GetAttemptsResponse(
        items=items,
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
    )

    return response
