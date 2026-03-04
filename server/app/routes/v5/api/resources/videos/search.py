"""Videos SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.videos.search import SQL_PATH, search_videos_internal
from app.sql.types import (
    SearchVideosApiRequest,
    SearchVideosApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/videos/search",
    response_model=SearchVideosApiResponse,
)
async def search_videos(
    request: SearchVideosApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchVideosApiResponse:
    tags = ["resources", "videos"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_videos_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
            bypass_cache=bypass_cache,
            scenario=request.scenario or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchVideosApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_videos",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
