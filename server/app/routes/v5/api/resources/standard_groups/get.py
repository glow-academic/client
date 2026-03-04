"""Standard Groups GET endpoint - v4 API.

Provides get endpoint for batch fetching standard_groups by IDs.
"""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.resources.standard_groups.types import (
    GetStandardGroupsApiRequest,
    GetStandardGroupsApiResponse,
)
from app.routes.v5.tools.resources.standard_groups.get import (
    get_standard_groups_internal,
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
    "/standard_groups/get",
    response_model=GetStandardGroupsApiResponse,
)
async def get_standard_groups(
    request: GetStandardGroupsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetStandardGroupsApiResponse:
    """Get standard_groups by IDs."""
    tags = ["resources", "standard_groups"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        items = await get_standard_groups_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetStandardGroupsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_standard_groups",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
