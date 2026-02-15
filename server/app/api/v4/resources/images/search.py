"""Images SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    QGetImagesV4Item,
    SearchImagesApiRequest,
    SearchImagesApiResponse,
    SearchImagesSqlParams,
    SearchImagesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/images/search_images_complete.sql"

router = APIRouter()


async def search_images_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    upload_ids: list[UUID] | None = None,
    completed: bool | None = None,
    bypass_cache: bool = False,
    *,
    scenario: bool = False,
) -> list[QGetImagesV4Item]:
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "images"]
    cache_key_val = cache_key(
        "/api/v4/resources/images/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "upload_ids": sorted(str(i) for i in (upload_ids or [])),
            "completed": completed,
            "scenario": scenario,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetImagesV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchImagesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        upload_ids=upload_ids or [],
        completed=completed,
        scenario=scenario,
    )
    result = cast(
        SearchImagesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetImagesV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/images/search",
    response_model=SearchImagesApiResponse,
)
async def search_images(
    request: SearchImagesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchImagesApiResponse:
    tags = ["resources", "images"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_images_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
            bypass_cache=bypass_cache,
            scenario=request.scenario or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchImagesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_images",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
