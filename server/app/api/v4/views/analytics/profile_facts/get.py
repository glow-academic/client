"""Get endpoint for analytics profile facts view (mv_profile_facts)."""

from datetime import date
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.analytics.profile_facts.types import (
    FilterOption,
    GetProfileFactsRequest,
    GetProfileFactsResponse,
    ProfileFactsItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/analytics/profile_facts/get_analytics_profile_facts_view_complete.sql"

router = APIRouter()


async def get_profile_facts_internal(
    conn: asyncpg.Connection,
    profile_id: UUID | None = None,
    cohort_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    simulation_ids: list[UUID] | None = None,
    attempt_type: str | None = None,
    is_archived: bool = False,
    date_from: date | None = None,
    date_to: date | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 10000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetProfileFactsResponse:
    """Internal function for fetching profile facts data.

    This can be reused by dashboard artifact endpoints, leaderboard, and reports.
    Returns chat-grain rows from mv_profile_facts with filtering and pagination.
    """
    from app.sql.types import (
        GetAnalyticsProfileFactsViewSqlParams,
    )

    cache_key_val = cache_key(
        "views/analytics/profile_facts/get",
        {
            "profile_id": str(profile_id) if profile_id else None,
            "cohort_ids": [str(c) for c in cohort_ids] if cohort_ids else None,
            "department_ids": [str(d) for d in department_ids]
            if department_ids
            else None,
            "simulation_ids": [str(s) for s in simulation_ids]
            if simulation_ids
            else None,
            "attempt_type": attempt_type,
            "is_archived": is_archived,
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
            return GetProfileFactsResponse.model_validate(cached)

    # Execute SQL query
    params = GetAnalyticsProfileFactsViewSqlParams(
        profile_id_filter=profile_id,
        cohort_ids=cohort_ids,
        department_ids=department_ids,
        simulation_ids=simulation_ids,
        attempt_type_filter=attempt_type,
        is_archived_filter=is_archived,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_order=sort_order,
        page_limit=page_limit,
        page_offset=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    # Transform to response items
    items: list[ProfileFactsItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                ProfileFactsItem(
                    chat_id=item.chat_id,
                    attempt_id=item.attempt_id,
                    profile_id=item.profile_id,
                    cohort_id=item.cohort_id,
                    department_id=item.department_id,
                    simulation_id=item.simulation_id,
                    scenario_id=item.scenario_id,
                    attempt_date=item.attempt_date,
                    grade_percent=float(item.grade_percent)
                    if item.grade_percent is not None
                    else None,
                    passed=item.passed,
                    completed=item.completed or False,
                    time_taken_seconds=item.time_taken_seconds,
                    num_messages_total=item.num_messages_total or 0,
                    avg_response_sec=float(item.avg_response_sec)
                    if item.avg_response_sec is not None
                    else None,
                    attempt_type=item.attempt_type,
                    is_archived=item.is_archived or False,
                    infinite_mode=item.infinite_mode or False,
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

    # Transform cohort filter options
    cohort_options: list[FilterOption] | None = None
    if result and result.cohort_options:
        cohort_options = [
            FilterOption(
                value=opt.value or "",
                label=opt.label or "",
                count=opt.count or 0,
            )
            for opt in result.cohort_options
            if opt.value
        ]

    # Transform department filter options
    department_options: list[FilterOption] | None = None
    if result and result.department_options:
        department_options = [
            FilterOption(
                value=opt.value or "",
                label=opt.label or "",
                count=opt.count or 0,
            )
            for opt in result.department_options
            if opt.value
        ]

    response = GetProfileFactsResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
        simulation_options=simulation_options,
        cohort_options=cohort_options,
        department_options=department_options,
    )

    # Cache the result
    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "analytics", "profile_facts"],
    )

    return response


@router.post(
    "/get",
    response_model=GetProfileFactsResponse,
    dependencies=[
        audit_activity(
            "views.analytics.profile_facts.get",
            "{{ actor.name }} fetched profile facts data",
        )
    ],
)
async def get_profile_facts(
    request: GetProfileFactsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProfileFactsResponse:
    """Get profile facts data from mv_profile_facts.

    This endpoint fetches filtered chat-grain rows for the dashboard
    header, leaderboard, and reports with:
    - Filtering (profile, cohort, department, simulation, attempt_type, archived, date range)
    - Sorting (date)
    - Pagination
    - Filter options (simulation_options, cohort_options, department_options)

    All aggregation (profile metrics, daily trends, etc.) is done in Python
    by the consuming artifact endpoints.
    """
    tags = ["views", "analytics", "profile_facts"]

    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        result = await get_profile_facts_internal(
            conn=conn,
            profile_id=request.profile_id,
            cohort_ids=request.cohort_ids,
            department_ids=request.department_ids,
            simulation_ids=request.simulation_ids,
            attempt_type=request.attempt_type,
            is_archived=request.is_archived,
            date_from=request.date_from,
            date_to=request.date_to,
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
            operation="views_analytics_profile_facts_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
