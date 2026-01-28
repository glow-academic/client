"""Images GET endpoint - v4 API.

Provides get endpoint for fetching a single image by ID.
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

SQL_PATH = "app/sql/v4/queries/resources/images/get_image_complete.sql"

router = APIRouter()


# =============================================================================
# Types
# =============================================================================


class GetImageV4Item(BaseModel):
    """Image item returned from get endpoint."""

    image_id: UUID | None = None
    name: str | None = None
    file_path: str | None = None
    mime_type: str | None = None
    upload_id: UUID | None = None
    generated: bool | None = None


class GetImageApiRequest(BaseModel):
    """Request for getting an image by ID."""

    id: UUID


class GetImageApiResponse(BaseModel):
    """Response for getting an image."""

    item: GetImageV4Item | None = None


class GetImageSqlParams(BaseModel):
    """SQL parameters for get image."""

    id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.id,)


class GetImageSqlRow(BaseModel):
    """SQL row for get image."""

    item: GetImageV4Item | None = None


# =============================================================================
# Internal Function
# =============================================================================


async def get_image_internal(
    conn: asyncpg.Connection,
    id: UUID,
    bypass_cache: bool = False,
) -> GetImageV4Item | None:
    """Internal function for fetching a single image."""
    cache_key_val = cache_key("images/get", {"id": str(id)})

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            item_data = cached.get("data")
            if item_data:
                return GetImageV4Item.model_validate(item_data)
            return None

    params = GetImageSqlParams(id=id)
    result = cast(
        GetImageSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    item = result.item if result else None

    await set_cached(
        cache_key_val,
        {"data": item.model_dump(mode="json") if item else None},
        ttl=60,
        tags=["images"],
    )

    return item


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/images/get",
    response_model=GetImageApiResponse,
)
async def get_image(
    request: GetImageApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetImageApiResponse:
    """Get image by ID."""
    tags = ["resources", "images"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        item = await get_image_internal(conn, request.id, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetImageApiResponse(item=item)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_image",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
