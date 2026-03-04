"""Objectives GET endpoint - v4 API.

Provides get endpoint for fetching a single objective by ID.
"""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.resources.objectives.types import (
    GetObjectiveApiRequest,
    GetObjectiveApiResponse,
)
from app.routes.v5.tools.resources.objectives.get import (
    SQL_PATH,
    get_objective_internal,
)
from app.sql.types import (
    load_sql_query,
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
    "/objectives/get",
    response_model=GetObjectiveApiResponse,
)
async def get_objective(
    request: GetObjectiveApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetObjectiveApiResponse:
    """Get objective by ID."""
    tags = ["resources", "objectives"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        item = await get_objective_internal(conn, request.id, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetObjectiveApiResponse(item=item)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_objective",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
