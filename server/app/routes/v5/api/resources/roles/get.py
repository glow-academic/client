"""Roles GET endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.resources.roles.types import (
    GetRolesApiRequest,
    GetRolesApiResponse,
)
from app.routes.v5.tools.resources.roles.get import get_roles_internal
from app.utils.error.handle_route_error import handle_route_error

# Load SQL with types at module level
router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================

# =============================================================================
# HTTP Endpoint
# =============================================================================

@router.post(
    "/roles/get",
    response_model=GetRolesApiResponse,
)
async def get_roles(
    request: GetRolesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetRolesApiResponse:
    """Get all roles.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "roles"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_roles_internal(conn, request.ids or [], bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetRolesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_roles",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
