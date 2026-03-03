"""Videos SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import (
    QGetVideosV4Item,
    SearchVideosApiRequest,
    SearchVideosApiResponse,
    SearchVideosSqlParams,
    SearchVideosSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/resources/videos/search_videos_complete.sql"

router = APIRouter()


async def search_videos_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    upload_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    scenario: bool = False,
) -> list[QGetVideosV4Item]:
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "videos"]
    cache_key_val = cache_key(
        "/api/v5/resources/videos/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "upload_ids": sorted(str(i) for i in (upload_ids or [])),
            "scenario": scenario,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetVideosV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchVideosSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        upload_ids=upload_ids or [],
        scenario=scenario,
    )
    result = cast(
        SearchVideosSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetVideosV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


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
