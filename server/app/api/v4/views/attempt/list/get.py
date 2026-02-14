"""Get endpoint for attempt list view."""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.attempt.list.types import (
    AttemptViewItem,
    FilterOption,
    GetAttemptsRequest,
    GetAttemptsResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/attempt/list/get_attempt_list_view_complete.sql"

router = APIRouter()


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
    """Internal function for fetching attempt data.

    This can be reused by artifact routes that need attempt data.

    Args:
        conn: Database connection
        attempt_ids: List of attempt IDs to fetch (optional)
        profile_id_filter: Filter by profile ID (optional)
        simulation_id_filter: Filter by simulation ID (optional)
        practice_filter: Filter by practice flag (optional)
        is_archived_filter: Filter archived attempts (default excludes archived)
        cohort_ids: Filter by cohort IDs (optional)
        department_ids: Filter by department IDs (optional)
        scenario_ids_filter: Filter by scenario IDs (optional)
        infinite_mode_filter: Filter by infinite mode (optional)
        date_from: Filter by date range start (inclusive)
        date_to: Filter by date range end (exclusive)
        sort_by: Sort field ('date')
        sort_order: Sort order ('asc' | 'desc')
        page_limit: Items per page
        page_offset: Pagination offset
        bypass_cache: Skip cache lookup

    Returns:
        GetAttemptsResponse with items, total_count, and filter options
    """
    from app.sql.types import (
        GetAttemptListViewSqlParams,
    )

    cache_key_val = cache_key(
        "views/attempt/list/get",
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

    # Execute SQL query
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

    # Transform to response items
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

    # Transform simulation filter options
    simulation_options: list[FilterOption] | None = None
    if result and result.simulation_options:
        simulation_options = [
            FilterOption(
                value=opt.value or "",
                label=opt.label or "",
                count=opt.count or 0,
            )
            for opt in result.simulation_options
            if opt.value
        ]

    # Transform scenario filter options
    scenario_options: list[FilterOption] | None = None
    if result and result.scenario_options:
        scenario_options = [
            FilterOption(
                value=opt.value or "",
                label=opt.label or "",
                count=opt.count or 0,
            )
            for opt in result.scenario_options
            if opt.value
        ]

    # Transform profile filter options
    profile_options: list[FilterOption] | None = None
    if result and result.profile_options:
        profile_options = [
            FilterOption(
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

    # Cache the result
    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "attempt", "list"],
    )

    return response


@router.post(
    "/get",
    response_model=GetAttemptsResponse,
    dependencies=[
        audit_activity(
            "views.attempt.list.get",
            "{{ actor.name }} fetched attempt list data",
        )
    ],
)
async def get_attempts(
    request: GetAttemptsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptsResponse:
    """Get attempt data from the materialized view.

    This endpoint fetches attempt-level data with resource metadata JOINed.
    """
    tags = ["views", "attempt", "list"]

    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        result = await get_attempt_list_internal(
            conn=conn,
            attempt_ids=request.attempt_ids,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_attempt_list_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
