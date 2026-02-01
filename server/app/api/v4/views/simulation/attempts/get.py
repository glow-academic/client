"""Get endpoint for simulation attempts view."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.simulation.attempts.types import (
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

SQL_PATH = "app/sql/v4/queries/views/simulation/attempts/get_simulation_attempts_view_complete.sql"

router = APIRouter()


async def get_simulation_attempts_internal(
    conn: asyncpg.Connection,
    attempt_ids: list[UUID],
    practice: bool | None = None,
    profile_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[AttemptViewItem]:
    """Internal function for fetching attempt data.

    This can be reused by analytics routes that need attempt data.

    Args:
        conn: Database connection
        attempt_ids: List of attempt IDs to fetch
        practice: Filter by practice mode
        profile_id: Filter by profile ID (artifact ID, will be resolved to resource ID)
        bypass_cache: Skip cache lookup

    Returns:
        List of AttemptViewItem objects
    """
    from app.sql.types import (
        GetSimulationAttemptsViewSqlParams,
        GetSimulationAttemptsViewSqlRow,
    )

    # Resolve profile_id (artifact) to profiles_id (resource) for MV filtering
    profiles_id: UUID | None = None
    if profile_id:
        profiles_id = await conn.fetchval(
            """
            SELECT profiles_id FROM profile_profiles_junction
            WHERE profile_id = $1 AND active = true
            LIMIT 1
            """,
            profile_id,
        )

    cache_key_val = cache_key(
        "views/simulation/attempts/get",
        {
            "attempt_ids": [str(a) for a in attempt_ids],
            "practice": practice,
            "profile_id": str(profiles_id) if profiles_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [AttemptViewItem.model_validate(item) for item in cached["items"]]

    # Execute SQL query (pass profiles_id, not profile_id)
    params = GetSimulationAttemptsViewSqlParams(
        attempt_ids=attempt_ids,
        practice_filter=practice,
        profile_id_filter=profiles_id,
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
        tags=["views", "simulation", "attempts"],
    )

    return items


@router.post(
    "/get",
    response_model=GetAttemptsResponse,
    dependencies=[
        audit_activity(
            "views.simulation.attempts.get",
            "{{ actor.name }} fetched simulation attempt data",
        )
    ],
)
async def get_attempts(
    request: GetAttemptsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptsResponse:
    """Get simulation attempt data from the materialized view.

    This endpoint fetches attempt-level data with resource metadata JOINed.
    """
    tags = ["views", "simulation", "attempts"]

    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from request state
        profile_id = http_request.state.profile_id

        items = await get_simulation_attempts_internal(
            conn=conn,
            attempt_ids=request.attempt_ids,
            practice=request.practice,
            profile_id=profile_id,
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
            operation="views_simulation_attempts_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
