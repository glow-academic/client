"""Images GET endpoint - v4 API.

Provides get endpoint for fetching a single image by ID.
"""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.resources.images.types import (
    GetImageApiRequest,
    GetImageApiResponse,
    GetImageSqlParams,
    GetImageSqlRow,
    GetImageV4Item,
)
from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import (
    GetImagesSqlParams,
    GetImagesSqlRow,
    QGetImagesV4Item,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/resources/images/get_image_complete.sql"
BATCH_SQL_PATH = "app/v5/sql/queries/resources/images/get_images_complete.sql"

router = APIRouter()

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

    items = result.items if result and result.items else []
    item = items[0] if items else None

    await set_cached(
        cache_key_val,
        {"data": item.model_dump(mode="json") if item else None},
        ttl=60,
        tags=["images"],
    )

    return item


async def get_images_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetImagesV4Item]:
    """Internal function for batch fetching images by IDs.

    This is a simple fetch without active flag check, used by scenario GET.
    """
    if not ids:
        return []

    tags = ["resources", "images"]
    cache_key_val = cache_key(
        "/api/v5/resources/images/get-batch",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetImagesV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetImagesSqlParams(p_ids=ids)
    result = cast(
        GetImagesSqlRow,
        await execute_sql_typed(conn, BATCH_SQL_PATH, params=params),
    )

    items: list[QGetImagesV4Item] = result.items if result and result.items else []

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
