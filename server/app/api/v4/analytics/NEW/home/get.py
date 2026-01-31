"""Home overview endpoint - POST /home/get.

Uses two-pass pattern:
1. Query 1 (Context): Fetch user context, permissions, and settings
2. Python Business Logic: Compute mode from user role
3. Query 2 (Data): Fetch actual data using context
"""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.analytics.NEW.home.permissions import compute_mode
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetHomeContextSqlParams,
    GetHomeContextSqlRow,
    GetHomeOverviewNewApiRequest,
    GetHomeOverviewNewApiResponse,
    GetHomeOverviewNewSqlParams,
    GetHomeOverviewNewSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

CONTEXT_SQL_PATH = "app/sql/v4/queries/analytics/NEW/home/get_home_context_complete.sql"
DATA_SQL_PATH = "app/sql/v4/queries/analytics/NEW/home/get_home_overview_new_complete.sql"

router = APIRouter()


@router.post(
    "/get",
    response_model=GetHomeOverviewNewApiResponse,
    dependencies=[
        audit_activity("home.new.get", "{{ actor.name }} viewed new home overview")
    ],
)
async def home_get(
    request: GetHomeOverviewNewApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHomeOverviewNewApiResponse:
    """Get home overview with simulation cards.

    Uses two-pass pattern:
    1. Context query for user info and permissions
    2. Data query for simulation cards and metadata
    """
    tags = ["home", "new"]

    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetHomeOverviewNewApiResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # === QUERY 1: Context (cheap, always fresh) ===
        context_params = GetHomeContextSqlParams(profile_id=profile_id)
        context = cast(
            GetHomeContextSqlRow,
            await execute_sql_typed(conn, CONTEXT_SQL_PATH, params=context_params),
        )

        # === PYTHON BUSINESS LOGIC ===
        mode = compute_mode(context.user_role)

        # === QUERY 2: Data Fetching ===
        request_dict = request.model_dump(mode="json")
        data_params = GetHomeOverviewNewSqlParams(
            **request_dict, profile_id=profile_id
        )  # type: ignore[arg-type]
        sql_params = data_params.to_tuple()

        data = cast(
            GetHomeOverviewNewSqlRow,
            await execute_sql_typed(conn, DATA_SQL_PATH, params=data_params),
        )

        # Set audit context
        if context.actor_name:
            audit_set(
                http_request, actor={"name": context.actor_name, "id": profile_id}
            )

        # === BUILD RESPONSE ===
        # Combine context actor_name with data, add mode computed in Python
        api_response = GetHomeOverviewNewApiResponse(
            actor_name=context.actor_name,
            mode=mode,  # Computed in Python
            has_data=data.has_data,  # From SQL
            items=data.items,
            standard_groups=data.standard_groups,
            standards=data.standards,
            simulations=data.simulations,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=300,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="home_new_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
