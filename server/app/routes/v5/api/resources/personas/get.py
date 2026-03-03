"""Personas GET endpoint - v4 API.

Provides get endpoint for fetching a single persona by ID.
"""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.personas.get import SQL_PATH, get_persona_internal
from app.sql.types import (
    GetPersonaResourceApiRequest,
    GetPersonaResourceApiResponse,
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
    "/personas/get",
    response_model=GetPersonaResourceApiResponse,
)
async def get_persona(
    request: GetPersonaResourceApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPersonaResourceApiResponse:
    """Get persona by ID."""
    tags = ["resources", "personas"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        item = await get_persona_internal(conn, request.id, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetPersonaResourceApiResponse(item=item)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_persona",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
