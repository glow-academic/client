"""Get endpoint for attempt list view."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.attempt.list.types import (
    AttemptViewItem,
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
    bypass_cache: bool = False,
) -> list[AttemptViewItem]:
    """Internal function for fetching attempt data.

    This can be reused by analytics routes that need attempt data.

    Args:
        conn: Database connection
        attempt_ids: List of attempt IDs to fetch (optional)
        profile_id_filter: Filter by profile ID (optional)
        simulation_id_filter: Filter by simulation ID (optional)
        practice_filter: Filter by practice flag (optional)
        bypass_cache: Skip cache lookup

    Returns:
        List of AttemptViewItem objects
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
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [AttemptViewItem.model_validate(item) for item in cached["items"]]

    # Execute SQL query
    params = GetAttemptListViewSqlParams(
        attempt_ids=attempt_ids,
        profile_id_filter=profile_id_filter,
        simulation_id_filter=simulation_id_filter,
        practice_filter=practice_filter,
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
                )
            )

    # Cache the result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "attempt", "list"],
    )

    return items


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
        items = await get_attempt_list_internal(
            conn=conn,
            attempt_ids=request.attempt_ids,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAttemptsResponse(items=items)

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
