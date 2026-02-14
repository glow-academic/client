"""Get endpoint for analytics rubric facts view (mv_rubric_facts)."""

from datetime import date
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.analytics.rubric_facts.types import (
    FilterOption,
    GetRubricFactsRequest,
    GetRubricFactsResponse,
    RubricFactsItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/analytics/rubric_facts/get_analytics_rubric_facts_view_complete.sql"

router = APIRouter()


async def get_rubric_facts_internal(
    conn: asyncpg.Connection,
    profile_id: UUID | None = None,
    cohort_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    simulation_ids: list[UUID] | None = None,
    rubric_ids: list[UUID] | None = None,
    attempt_type: str | None = None,
    is_archived: bool = False,
    date_from: date | None = None,
    date_to: date | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 10000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetRubricFactsResponse:
    """Internal function for fetching rubric facts data.

    This can be reused by dashboard artifact endpoints and other analytics routes.

    Args:
        conn: Database connection
        profile_id: Filter by single profile ID
        cohort_ids: Filter by cohort IDs
        simulation_ids: Filter by simulation IDs
        rubric_ids: Filter by rubric IDs
        attempt_type: Filter by attempt type ('general' | 'practice')
        is_archived: Include archived attempts (default False)
        date_from: Filter by date range start (inclusive)
        date_to: Filter by date range end (inclusive)
        sort_by: Sort field ('date')
        sort_order: Sort order ('asc' | 'desc')
        page_limit: Items per page
        page_offset: Pagination offset
        bypass_cache: Skip cache lookup

    Returns:
        GetRubricFactsResponse with items, total_count, and filter options
    """
    from app.sql.types import (
        GetAnalyticsRubricFactsViewSqlParams,
    )

    cache_key_val = cache_key(
        "views/analytics/rubric_facts/get",
        {
            "profile_id": str(profile_id) if profile_id else None,
            "cohort_ids": [str(c) for c in cohort_ids] if cohort_ids else None,
            "department_ids": [str(d) for d in department_ids]
            if department_ids
            else None,
            "simulation_ids": [str(s) for s in simulation_ids]
            if simulation_ids
            else None,
            "rubric_ids": [str(r) for r in rubric_ids] if rubric_ids else None,
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
            return GetRubricFactsResponse.model_validate(cached)

    # Execute SQL query
    params = GetAnalyticsRubricFactsViewSqlParams(
        profile_id_filter=profile_id,
        cohort_ids=cohort_ids,
        department_ids=department_ids,
        simulation_ids=simulation_ids,
        rubric_ids=rubric_ids,
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
    items: list[RubricFactsItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                RubricFactsItem(
                    chat_id=item.chat_id,
                    standard_group_id=item.standard_group_id,
                    rubric_id=item.rubric_id,
                    score_percent=float(item.score_percent)
                    if item.score_percent is not None
                    else None,
                    simulation_id=item.simulation_id,
                    profile_id=item.profile_id,
                    cohort_id=item.cohort_id,
                    department_id=item.department_id,
                    attempt_date=item.attempt_date,
                    attempt_type=item.attempt_type,
                    is_archived=item.is_archived or False,
                )
            )

    # Transform rubric filter options
    rubric_options: list[FilterOption] | None = None
    if result and result.rubric_options:
        rubric_options = [
            FilterOption(
                value=opt.value or "",
                label=opt.label or "",
                count=opt.count or 0,
            )
            for opt in result.rubric_options
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

    # Transform standard group filter options
    standard_group_options: list[FilterOption] | None = None
    if result and result.standard_group_options:
        standard_group_options = [
            FilterOption(
                value=opt.value or "",
                label=opt.label or "",
                count=opt.count or 0,
            )
            for opt in result.standard_group_options
            if opt.value
        ]

    response = GetRubricFactsResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
        rubric_options=rubric_options,
        department_options=department_options,
        simulation_options=simulation_options,
        standard_group_options=standard_group_options,
    )

    # Cache the result
    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "analytics", "rubric_facts"],
    )

    return response


@router.post(
    "/get",
    response_model=GetRubricFactsResponse,
    dependencies=[
        audit_activity(
            "views.analytics.rubric_facts.get",
            "{{ actor.name }} fetched rubric facts data",
        )
    ],
)
async def get_rubric_facts(
    request: GetRubricFactsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetRubricFactsResponse:
    """Get rubric facts data from mv_rubric_facts.

    This endpoint fetches paginated per-chat standard-group score data
    for the rubric dashboard section with:
    - Filtering (profile, cohort, simulation, rubric, attempt_type, archived, date range)
    - Sorting (date)
    - Pagination
    - Filter options (rubric_options, simulation_options, standard_group_options)

    Resource metadata (names, colors, icons) should be fetched separately
    via internal resource handlers using the returned IDs.
    """
    tags = ["views", "analytics", "rubric_facts"]

    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        result = await get_rubric_facts_internal(
            conn=conn,
            profile_id=request.profile_id,
            cohort_ids=request.cohort_ids,
            department_ids=request.department_ids,
            simulation_ids=request.simulation_ids,
            rubric_ids=request.rubric_ids,
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
            operation="views_analytics_rubric_facts_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
