"""Scenario time limits search endpoint - v4 API.

Provides search endpoint for finding available scenario time limits for scenarios.
"""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.scenario_time_limits.search import (
    SQL_PATH,
    search_scenario_time_limits_internal,
)
from app.sql.types import (
    SearchScenarioTimeLimitsApiRequest,
    SearchScenarioTimeLimitsApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/scenario_time_limits/search",
    response_model=SearchScenarioTimeLimitsApiResponse,
)
async def search_scenario_time_limits(
    request: SearchScenarioTimeLimitsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchScenarioTimeLimitsApiResponse:
    """Search available scenario time limits for scenarios."""
    tags = ["resources", "scenario_time_limits"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        items = await search_scenario_time_limits_internal(
            conn=conn,
            scenario_ids=request.scenario_ids or [],
            bypass_cache=bypass_cache,
            simulation=request.simulation or False,
        )

        api_response = SearchScenarioTimeLimitsApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_scenario_time_limits",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
