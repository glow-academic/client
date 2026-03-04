"""Systems SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.systems.search import (
    SQL_PATH,
    search_systems_internal,
)
from app.sql.types import (
    SearchSystemsApiRequest,
    SearchSystemsApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/systems/search",
    response_model=SearchSystemsApiResponse,
)
async def search_systems(
    request: SearchSystemsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchSystemsApiResponse:
    """Search systems resources."""
    tags = ["resources", "systems"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_systems_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
            request.agent_ids,
            bypass_cache=bypass_cache,
            setting=request.setting or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchSystemsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_systems",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
