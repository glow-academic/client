"""Reasoning Levels GET endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.reasoning_levels.get import (
    SQL_PATH,
    get_reasoning_levels_internal,
)
from app.sql.types import (
    GetReasoningLevelsApiRequest,
    GetReasoningLevelsApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

# Load SQL with types at module level
router = APIRouter()

@router.post(
    "/reasoning_levels/get",
    response_model=GetReasoningLevelsApiResponse,
)
async def get_reasoning_levels(
    request: GetReasoningLevelsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetReasoningLevelsApiResponse:
    """Get reasoning_levels resources by IDs.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "reasoning_levels"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_reasoning_levels_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetReasoningLevelsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_reasoning_levels",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
