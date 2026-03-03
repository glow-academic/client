"""Standards GET endpoint - v4 API.

Provides get endpoint for batch fetching standards by IDs.
"""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.resources.standards.types import (
    GetStandardsApiRequest,
    GetStandardsApiResponse,
)
from app.routes.v5.tools.resources.standards.get import get_standards_internal
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================

# =============================================================================
# HTTP Endpoint
# =============================================================================

@router.post(
    "/standards/get",
    response_model=GetStandardsApiResponse,
)
async def get_standards(
    request: GetStandardsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetStandardsApiResponse:
    """Get standards by IDs."""
    tags = ["resources", "standards"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        items = await get_standards_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetStandardsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_standards",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
