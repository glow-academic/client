"""Get endpoint for simulation history view."""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.simulation.history.types import (
    FilterOption,
    GetHistoryRequest,
    GetHistoryResponse,
    HistoryViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/history/get_simulation_history_view_complete.sql"

router = APIRouter()


async def get_simulation_history_internal(
    conn: asyncpg.Connection,
    profile_id: UUID | None = None,
    simulation_ids: list[UUID] | None = None,
    cohort_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    practice: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    scenario_ids: list[UUID] | None = None,
    infinite_mode: bool | None = None,
    search: str | None = None,
    sort_by: str | None = "date",
    sort_order: str | None = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    profile_ids: list[UUID] | None = None,
    show_archived: bool = False,
    bypass_cache: bool = False,
) -> GetHistoryResponse:
    """Internal function for fetching history data.

    This can be reused by analytics routes that need history data.

    Args:
        conn: Database connection
        profile_id: Filter by single profile ID
        simulation_ids: Filter by simulation IDs
        cohort_ids: Filter by cohort IDs
        department_ids: Filter by department IDs
        practice: Filter by practice mode
        date_from: Filter by date range start
        date_to: Filter by date range end
        scenario_ids: Filter by scenario IDs
        infinite_mode: Filter by infinite mode
        search: Search by simulation name
        sort_by: Sort field (date, score, simulation_name)
        sort_order: Sort order (asc, desc)
        page_limit: Items per page
        page_offset: Pagination offset
        profile_ids: Filter by multiple profile IDs (for multi-user view)
        show_archived: Include archived attempts
        bypass_cache: Skip cache lookup

    Returns:
        GetHistoryResponse with items, total_count, filter options
    """
    from app.sql.types import (
        GetSimulationHistoryViewSqlParams,
    )

    cache_key_val = cache_key(
        "views/simulation/history/get",
        {
            "profile_id": str(profile_id) if profile_id else None,
            "simulation_ids": [str(s) for s in simulation_ids] if simulation_ids else None,
            "cohort_ids": [str(c) for c in cohort_ids] if cohort_ids else None,
            "department_ids": [str(d) for d in department_ids] if department_ids else None,
            "practice": practice,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "scenario_ids": [str(s) for s in scenario_ids] if scenario_ids else None,
            "infinite_mode": infinite_mode,
            "search": search,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
            "profile_ids": [str(p) for p in profile_ids] if profile_ids else None,
            "show_archived": show_archived,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetHistoryResponse.model_validate(cached)

    # Execute SQL query
    params = GetSimulationHistoryViewSqlParams(
        profile_id_filter=profile_id,
        simulation_ids=simulation_ids,
        cohort_ids=cohort_ids,
        department_ids=department_ids,
        practice_filter=practice,
        date_from=date_from,
        date_to=date_to,
        scenario_ids=scenario_ids,
        infinite_mode=infinite_mode,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        page_limit=page_limit,
        page_offset=page_offset,
        profile_ids=profile_ids,
        show_archived=show_archived,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    # Transform to response items
    items: list[HistoryViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                HistoryViewItem(
                    attempt_id=item.attempt_id,
                    profile_id=item.profile_id,
                    simulation_id=item.simulation_id,
                    cohort_id=item.cohort_id,
                    department_id=item.department_id,
                    simulation_name=item.simulation_name,
                    profile_name=item.profile_name,
                    cohort_name=item.cohort_name,
                    department_name=item.department_name,
                    persona_color=item.persona_color,
                    persona_icon=item.persona_icon,
                    time_limit=item.time_limit,
                    attempt_created_at=item.attempt_created_at,
                    practice=item.practice or False,
                    infinite_mode=item.infinite_mode or False,
                    is_archived=item.is_archived or False,
                    num_chats=item.num_chats or 0,
                    num_chats_completed=item.num_chats_completed or 0,
                    num_scenarios=item.num_scenarios or 0,
                    num_scenarios_completed=item.num_scenarios_completed or 0,
                    score_percent=float(item.score_percent) if item.score_percent else None,
                    has_passed=item.has_passed or False,
                    total_time_seconds=item.total_time_seconds or 0,
                    rubric_total_points=item.rubric_total_points,
                    rubric_pass_points=item.rubric_pass_points,
                    scenario_ids=item.scenario_ids,
                    persona_ids=item.persona_ids,
                    scenario_names=item.scenario_names,
                    persona_names=item.persona_names,
                    persona_colors=item.persona_colors,
                    department_ids=item.department_ids,
                )
            )

    # Transform simulation filter options
    simulation_options: list[FilterOption] | None = None
    if result and result.simulation_options:
        simulation_options = [
            FilterOption(
                value=opt.value,
                label=opt.label,
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
                value=opt.value,
                label=opt.label,
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
                value=opt.value,
                label=opt.label,
                count=opt.count or 0,
            )
            for opt in result.profile_options
            if opt.value
        ]

    response = GetHistoryResponse(
        actor_name=result.actor_name if result else None,
        total_count=result.total_count or 0 if result else 0,
        items=items,
        simulation_options=simulation_options,
        scenario_options=scenario_options,
        profile_options=profile_options,
    )

    # Cache the result
    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "simulation", "history"],
    )

    return response


@router.post(
    "/get",
    response_model=GetHistoryResponse,
    dependencies=[
        audit_activity(
            "views.simulation.history.get",
            "{{ actor.name }} fetched simulation history data",
        )
    ],
)
async def get_history(
    request: GetHistoryRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHistoryResponse:
    """Get simulation history data from the materialized view.

    This endpoint fetches paginated attempt history with:
    - Filtering (date, cohort, department, simulation, scenario, search, infinite_mode, archived, profile_ids)
    - Sorting and pagination
    - Filter options (simulation_options, scenario_options, profile_options)
    - All metadata JOINed
    """
    tags = ["views", "simulation", "history"]

    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from request state if not provided in request
        profile_id = request.profile_id
        if not profile_id:
            profile_id = http_request.state.profile_id

        result = await get_simulation_history_internal(
            conn=conn,
            profile_id=profile_id,
            simulation_ids=request.simulation_ids,
            cohort_ids=request.cohort_ids,
            department_ids=request.department_ids,
            practice=request.practice,
            date_from=request.date_from,
            date_to=request.date_to,
            scenario_ids=request.scenario_ids,
            infinite_mode=request.infinite_mode,
            search=request.search,
            sort_by=request.sort_by,
            sort_order=request.sort_order,
            page_limit=request.page_limit,
            page_offset=request.page_offset,
            profile_ids=request.profile_ids,
            show_archived=request.show_archived,
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
            operation="views_simulation_history_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
