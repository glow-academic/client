"""Get endpoint for analytics attempts view (mv_attempt_facts)."""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.analytics.attempts.types import (
    AttemptFactsItem,
    FilterOption,
    GetAttemptFactsRequest,
    GetAttemptFactsResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/analytics/attempts/get_analytics_attempts_view_complete.sql"

router = APIRouter()


async def get_attempt_facts_internal(
    conn: asyncpg.Connection,
    profile_id: UUID | None = None,
    attempt_type: str | None = None,
    is_archived: bool = False,
    simulation_ids: list[UUID] | None = None,
    cohort_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    scenario_ids: list[UUID] | None = None,
    infinite_mode: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    search: str | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetAttemptFactsResponse:
    """Internal function for fetching attempt facts data.

    This can be reused by training routes and other analytics routes.

    Args:
        conn: Database connection
        profile_id: Filter by single profile ID
        attempt_type: Filter by attempt type ('general' | 'practice')
        is_archived: Include archived attempts (default False)
        simulation_ids: Filter by simulation IDs
        cohort_ids: Filter by cohort IDs
        department_ids: Filter by department IDs
        scenario_ids: Filter by scenario IDs (matches if any overlap)
        infinite_mode: Filter by infinite mode
        date_from: Filter by date range start (inclusive)
        date_to: Filter by date range end (exclusive)
        search: Search term
        sort_by: Sort field ('date' | 'score')
        sort_order: Sort order ('asc' | 'desc')
        page_limit: Items per page
        page_offset: Pagination offset
        bypass_cache: Skip cache lookup

    Returns:
        GetAttemptFactsResponse with items, total_count, and filter options
    """
    from app.sql.types import (
        GetAnalyticsAttemptsViewSqlParams,
    )

    cache_key_val = cache_key(
        "views/analytics/attempts/get",
        {
            "profile_id": str(profile_id) if profile_id else None,
            "attempt_type": attempt_type,
            "is_archived": is_archived,
            "simulation_ids": [str(s) for s in simulation_ids]
            if simulation_ids
            else None,
            "cohort_ids": [str(c) for c in cohort_ids] if cohort_ids else None,
            "department_ids": [str(d) for d in department_ids]
            if department_ids
            else None,
            "scenario_ids": [str(s) for s in scenario_ids] if scenario_ids else None,
            "infinite_mode": infinite_mode,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "search": search,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetAttemptFactsResponse.model_validate(cached)

    # Execute SQL query
    params = GetAnalyticsAttemptsViewSqlParams(
        profile_id_filter=profile_id,
        attempt_type_filter=attempt_type,
        is_archived_filter=is_archived,
        simulation_ids=simulation_ids,
        cohort_ids=cohort_ids,
        department_ids=department_ids,
        scenario_ids=scenario_ids,
        infinite_mode=infinite_mode,
        date_from=date_from or datetime.min,  # Required field
        date_to=date_to or datetime.max,  # Required field
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        page_limit=page_limit,
        page_offset=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    # Transform to response items
    items: list[AttemptFactsItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                AttemptFactsItem(
                    attempt_id=item.attempt_id,
                    profile_id=item.profile_id,
                    simulation_id=item.simulation_id,
                    cohort_id=item.cohort_id,
                    department_id=item.department_id,
                    attempt_created_at=item.attempt_created_at,
                    attempt_type=item.attempt_type,
                    is_archived=item.is_archived or False,
                    infinite_mode=item.infinite_mode or False,
                    num_chats=item.num_chats or 0,
                    num_chats_completed=item.num_chats_completed or 0,
                    num_scenarios=item.num_scenarios or 0,
                    num_scenarios_completed=item.num_scenarios_completed or 0,
                    score_percent=float(item.score_percent)
                    if item.score_percent
                    else None,
                    has_passed=item.has_passed or False,
                    total_time_seconds=item.total_time_seconds or 0,
                    rubric_total_points=item.rubric_total_points,
                    rubric_pass_points=item.rubric_pass_points,
                    scenario_ids=item.scenario_ids,
                    persona_ids=item.persona_ids,
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

    response = GetAttemptFactsResponse(
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
        tags=["views", "analytics", "attempts"],
    )

    return response


@router.post(
    "/get",
    response_model=GetAttemptFactsResponse,
    dependencies=[
        audit_activity(
            "views.analytics.attempts.get",
            "{{ actor.name }} fetched attempt facts data",
        )
    ],
)
async def get_attempt_facts(
    request: GetAttemptFactsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptFactsResponse:
    """Get attempt facts data from mv_attempt_facts.

    This endpoint fetches paginated attempt-level data with:
    - Filtering (profile, attempt_type, archived, simulation, cohort, department, scenario, date, infinite_mode)
    - Sorting (date, score)
    - Pagination
    - Filter options (simulation_options, scenario_options, profile_options)

    Resource metadata (names, colors, icons) should be fetched separately
    via internal resource handlers using the returned IDs.
    """
    tags = ["views", "analytics", "attempts"]

    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        result = await get_attempt_facts_internal(
            conn=conn,
            profile_id=request.profile_id,
            attempt_type=request.attempt_type,
            is_archived=request.is_archived,
            simulation_ids=request.simulation_ids,
            cohort_ids=request.cohort_ids,
            department_ids=request.department_ids,
            scenario_ids=request.scenario_ids,
            infinite_mode=request.infinite_mode,
            date_from=request.date_from,
            date_to=request.date_to,
            search=request.search,
            sort_by=request.sort_by,
            sort_order=request.sort_order,
            page_limit=request.page_limit,
            page_offset=request.page_offset,
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
            operation="views_analytics_attempts_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
