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
    sort_by: str = "avg_score",
    sort_order: str = "desc",
    page_limit: int = 5000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetProfileFactsResponse:
    """Internal function for fetching profile facts data.

    This can be reused by dashboard artifact endpoints, leaderboard, and reports.

    Args:
        conn: Database connection
        profile_id: Filter by single profile ID
        cohort_ids: Filter by cohort IDs
        department_ids: Filter by department IDs
        simulation_ids: Filter by simulation IDs
        attempt_type: Filter by attempt type ('general' | 'practice')
        is_archived: Include archived attempts (default False)
        date_from: Filter by date range start (inclusive)
        date_to: Filter by date range end (inclusive)
        sort_by: Sort field ('avg_score' | 'total_attempts' | 'highest_score')
        sort_order: Sort order ('asc' | 'desc')
        page_limit: Items per page
        page_offset: Pagination offset
        bypass_cache: Skip cache lookup

    Returns:
        GetProfileFactsResponse with profile-level items, total_count, and filter options
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
                    profile_id=item.profile_id,
                    total_attempts=item.total_attempts or 0,
                    avg_score=float(item.avg_score)
                    if item.avg_score is not None
                    else None,
                    highest_score=float(item.highest_score)
                    if item.highest_score is not None
                    else None,
                    completion_pct=float(item.completion_pct)
                    if item.completion_pct is not None
                    else None,
                    first_attempt_pass_rate=float(item.first_attempt_pass_rate)
                    if item.first_attempt_pass_rate is not None
                    else None,
                    avg_messages_per_session=float(item.avg_messages_per_session)
                    if item.avg_messages_per_session is not None
                    else None,
                    avg_persona_response_sec=float(item.avg_persona_response_sec)
                    if item.avg_persona_response_sec is not None
                    else None,
                    session_efficiency=float(item.session_efficiency)
                    if item.session_efficiency is not None
                    else None,
                    total_time_minutes=float(item.total_time_minutes)
                    if item.total_time_minutes is not None
                    else None,
                    improvement_rate=float(item.improvement_rate)
                    if item.improvement_rate is not None
                    else 0.0,
                    perfect_score_count=item.perfect_score_count or 0,
                    quickest_pass_minutes=float(item.quickest_pass_minutes)
                    if item.quickest_pass_minutes is not None
                    else None,
                    daily_dates=list(item.daily_dates) if item.daily_dates else [],
                    daily_avg_scores=[
                        float(s) if s is not None else None
                        for s in item.daily_avg_scores
                    ]
                    if item.daily_avg_scores
                    else [],
                    daily_attempt_counts=list(item.daily_attempt_counts)
                    if item.daily_attempt_counts
                    else [],
                    daily_completed_counts=list(item.daily_completed_counts)
                    if item.daily_completed_counts
                    else [],
                    daily_time_minutes=[
                        float(t) if t is not None else None
                        for t in item.daily_time_minutes
                    ]
                    if item.daily_time_minutes
                    else [],
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

    This endpoint fetches profile-level aggregated metrics computed from
    chat-grain data for the dashboard header, leaderboard, and reports with:
    - Filtering (profile, cohort, department, simulation, attempt_type, archived, date range)
    - 12 profile metrics (avg_score, total_attempts, completion_pct, etc.)
    - Daily trend arrays (daily_dates, daily_avg_scores, etc.)
    - Sorting (avg_score, total_attempts, highest_score)
    - Pagination
    - Filter options (simulation_options, cohort_options, department_options)

    Resource metadata (names, avatars) should be fetched separately
    via internal resource handlers using the returned profile IDs.
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
