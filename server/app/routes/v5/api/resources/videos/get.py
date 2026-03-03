"""Videos GET endpoint - v4 API.

Provides get endpoint for fetching a single video by ID.
"""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.resources.videos.types import (
    GetVideoApiRequest,
    GetVideoApiResponse,
    GetVideoSqlParams,
    GetVideoSqlRow,
    GetVideoV4Item,
)
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db
from app.sql.types import (
    GetVideosSqlParams,
    GetVideosSqlRow,
    QGetVideosV4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/videos/get_video_complete.sql"
BATCH_SQL_PATH = "app/sql/queries/resources/videos/get_videos_complete.sql"

router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================


async def get_video_internal(
    conn: asyncpg.Connection,
    id: UUID,
    bypass_cache: bool = False,
) -> GetVideoV4Item | None:
    """Internal function for fetching a single video."""
    cache_key_val = cache_key("videos/get", {"id": str(id)})

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            item_data = cached.get("data")
            if item_data:
                return GetVideoV4Item.model_validate(item_data)
            return None

    params = GetVideoSqlParams(id=id)
    result = cast(
        GetVideoSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items = result.items if result and result.items else []
    item = items[0] if items else None

    await set_cached(
        cache_key_val,
        {"data": item.model_dump(mode="json") if item else None},
        ttl=60,
        tags=["videos"],
    )

    return item


async def get_videos_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetVideosV4Item]:
    """Internal function for batch fetching videos by IDs.

    This is a simple fetch without active flag check, used by scenario GET.
    """
    if not ids:
        return []

    tags = ["resources", "videos"]
    cache_key_val = cache_key(
        "/api/v5/resources/videos/get-batch",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetVideosV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetVideosSqlParams(p_ids=ids)
    result = cast(
        GetVideosSqlRow,
        await execute_sql_typed(conn, BATCH_SQL_PATH, params=params),
    )

    items: list[QGetVideosV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/videos/get",
    response_model=GetVideoApiResponse,
)
async def get_video(
    request: GetVideoApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetVideoApiResponse:
    """Get video by ID."""
    tags = ["resources", "videos"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        item = await get_video_internal(conn, request.id, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetVideoApiResponse(item=item)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_video",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
