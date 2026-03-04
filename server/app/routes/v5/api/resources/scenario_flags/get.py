"""Scenario flags get endpoint - v4 API.

Provides get endpoint for fetching scenario flags by resource IDs.
"""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.scenario_flags.get import (
    get_scenario_flags as get_scenario_flags_resource,
)
from app.sql.types import (
    GetScenarioFlagsApiRequest,
    GetScenarioFlagsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================

# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/scenario_flags/get",
    response_model=GetScenarioFlagsApiResponse,
)
async def get_scenario_flags(
    request: GetScenarioFlagsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetScenarioFlagsApiResponse:
    """Get scenario flags by resource IDs."""
    tags = ["resources", "scenario_flags"]

    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        items = await get_scenario_flags_resource(
            conn=conn,
            ids=request.ids or [],
            redis=get_redis_client(),
            bypass_cache=bypass_cache,
        )

        api_response = GetScenarioFlagsApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_scenario_flags",
            sql_query=None,
            sql_params=sql_params,
            request=http_request,
        )
