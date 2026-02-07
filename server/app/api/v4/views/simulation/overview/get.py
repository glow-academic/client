"""Get endpoint for simulation overview view."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.simulation.overview.types import (
    GetOverviewRequest,
    GetOverviewResponse,
    OverviewViewItem,
    StandardGroupItem,
    StandardItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/overview/get_simulation_overview_view_complete.sql"

router = APIRouter()


async def get_simulation_overview_internal(
    conn: asyncpg.Connection,
    profile_id: UUID | None = None,
    simulation_ids: list[UUID] | None = None,
    cohort_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    practice: bool | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    bypass_cache: bool = False,
) -> GetOverviewResponse:
    """Internal function for fetching overview data.

    This can be reused by analytics routes that need overview data.

    Args:
        conn: Database connection
        profile_id: Filter by profile ID
        simulation_ids: Filter by simulation IDs
        cohort_ids: Filter by cohort IDs
        department_ids: Filter by department IDs
        practice: Filter by practice mode
        start_date: Start date for filtering
        end_date: End date for filtering
        bypass_cache: Skip cache lookup

    Returns:
        GetOverviewResponse with items, standard_groups, standards
    """
    from app.sql.types import (
        GetSimulationOverviewViewSqlParams,
    )

    cache_key_val = cache_key(
        "views/simulation/overview/get",
        {
            "profile_id": str(profile_id) if profile_id else None,
            "simulation_ids": [str(s) for s in simulation_ids]
            if simulation_ids
            else None,
            "cohort_ids": [str(c) for c in cohort_ids] if cohort_ids else None,
            "department_ids": [str(d) for d in department_ids]
            if department_ids
            else None,
            "practice": practice,
            "start_date": start_date,
            "end_date": end_date,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetOverviewResponse.model_validate(cached)

    # Execute SQL query
    params = GetSimulationOverviewViewSqlParams(
        start_date=start_date,
        end_date=end_date,
        profile_id_filter=profile_id,
        simulation_ids=simulation_ids,
        cohort_ids=cohort_ids,
        department_ids=department_ids,
        practice_filter=practice,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    # Transform to response
    items: list[OverviewViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                OverviewViewItem(
                    simulation_id=item.simulation_id,
                    simulation_name=item.simulation_name,
                    simulation_description=item.simulation_description,
                    time_limit=item.time_limit,
                    department_ids=item.department_ids,
                    persona_color=item.persona_color,
                    persona_icon=item.persona_icon,
                    cohort_names=item.cohort_names,
                    standard_group_ids=item.standard_group_ids,
                    practice=item.practice,
                    attempt_count=item.attempt_count or 0,
                    completed_count=item.completed_count or 0,
                    highest_score=item.highest_score,
                    has_passed=item.has_passed or False,
                    rubric_total_points=item.rubric_total_points,
                    rubric_pass_points=item.rubric_pass_points,
                    passed_count=item.passed_count,
                    in_progress_count=item.in_progress_count,
                    not_started_count=item.not_started_count,
                    total_members=item.total_members,
                )
            )

    # Transform standard groups
    standard_groups: list[StandardGroupItem] | None = None
    if result and result.standard_groups:
        standard_groups = [
            StandardGroupItem(
                standard_group_id=sg.standard_group_id,
                name=sg.name,
                description=sg.description,
                points=sg.points,
                pass_points=sg.pass_points,
            )
            for sg in result.standard_groups
            if sg.standard_group_id
        ]

    # Transform standards
    standards: list[StandardItem] | None = None
    if result and result.standards:
        standards = [
            StandardItem(
                standard_id=st.standard_id,
                standard_group_id=st.standard_group_id,
                name=st.name,
                description=st.description,
                points=st.points,
            )
            for st in result.standards
            if st.standard_id
        ]

    response = GetOverviewResponse(
        actor_name=result.actor_name if result else None,
        user_role=result.user_role if result else None,
        has_data=result.has_data if result else False,
        items=items,
        standard_groups=standard_groups,
        standards=standards,
    )

    # Cache the result
    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "simulation", "overview"],
    )

    return response


@router.post(
    "/get",
    response_model=GetOverviewResponse,
    dependencies=[
        audit_activity(
            "views.simulation.overview.get",
            "{{ actor.name }} fetched simulation overview data",
        )
    ],
)
async def get_overview(
    request: GetOverviewRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetOverviewResponse:
    """Get simulation overview data from the materialized view.

    This endpoint fetches simulation-level aggregated data with:
    - Mode-aware aggregation (member vs instructional)
    - Instructional stats: passed_count, in_progress_count, not_started_count, total_members
    - Standard groups and standards for sidebar/legend
    """
    tags = ["views", "simulation", "overview"]

    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from request state if not provided in request
        profile_id = request.profile_id
        if not profile_id:
            profile_id = http_request.state.profile_id

        result = await get_simulation_overview_internal(
            conn=conn,
            profile_id=profile_id,
            simulation_ids=request.simulation_ids,
            cohort_ids=request.cohort_ids,
            department_ids=request.department_ids,
            practice=request.practice,
            start_date=request.start_date,
            end_date=request.end_date,
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
            operation="views_simulation_overview_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
