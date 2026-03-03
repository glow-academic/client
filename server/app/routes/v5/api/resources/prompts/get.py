"""Prompts GET endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.prompts.get import SQL_PATH, get_prompts_internal
from app.sql.types import (
    GetPromptsApiRequest,
    GetPromptsApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post(
    "/prompts/get",
    response_model=GetPromptsApiResponse,
)
async def get_prompts(
    request: GetPromptsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPromptsApiResponse:
    """Get prompts resources by IDs."""
    tags = ["resources", "prompts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_prompts_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetPromptsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_prompts",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
