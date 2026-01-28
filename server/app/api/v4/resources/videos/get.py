"""Videos GET endpoint - v4 API.

Provides get endpoint for fetching a single video by ID.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import load_sql_query
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/videos/get_video_complete.sql"

router = APIRouter()


# =============================================================================
# Types
# =============================================================================


class GetVideoV4Item(BaseModel):
    """Video item returned from get endpoint."""

    video_id: UUID | None = None
    name: str | None = None
    length_seconds: int | None = None
    completed: bool | None = None
    file_path: str | None = None
    mime_type: str | None = None
    upload_id: UUID | None = None
    generated: bool | None = None


class GetVideoApiRequest(BaseModel):
    """Request for getting a video by ID."""

    id: UUID


class GetVideoApiResponse(BaseModel):
    """Response for getting a video."""

    item: GetVideoV4Item | None = None


class GetVideoSqlParams(BaseModel):
    """SQL parameters for get video."""

    id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.id,)


class GetVideoSqlRow(BaseModel):
    """SQL row for get video."""

    item: GetVideoV4Item | None = None


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

    item = result.item if result else None

    await set_cached(
        cache_key_val,
        {"data": item.model_dump(mode="json") if item else None},
        ttl=60,
        tags=["videos"],
    )

    return item


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
