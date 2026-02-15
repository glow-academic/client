"""Get endpoint for image list view."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.image.list.types import (
    GetImageListViewResponse,
    ImageViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/image/list/get_image_list_view_complete.sql"

router = APIRouter()


async def get_image_list_view_internal(
    conn: asyncpg.Connection,
    uploads_id_filter: UUID | None = None,
    page_limit: int = 10000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetImageListViewResponse:
    """Internal function for fetching image data from mv_images."""
    from app.sql.types import GetImageListViewSqlParams

    cache_key_val = cache_key(
        "views/image/list/get",
        {
            "uploads_id_filter": str(uploads_id_filter) if uploads_id_filter else None,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetImageListViewResponse.model_validate(cached)

    params = GetImageListViewSqlParams(
        uploads_id_filter=uploads_id_filter,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[ImageViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                ImageViewItem(
                    image_id=item.image_id,
                    uploads_id=item.uploads_id,
                    upload_id=item.upload_id,
                    file_path=item.file_path,
                    mime_type=item.mime_type,
                    size=item.size,
                    created_at=item.created_at,
                )
            )

    response = GetImageListViewResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "image", "list"],
    )

    return response


@router.post(
    "/get",
    response_model=GetImageListViewResponse,
    dependencies=[
        audit_activity(
            "views.image.list.get",
            "{{ actor.name }} fetched image list data",
        )
    ],
)
async def get_images(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetImageListViewResponse:
    """Get image data from the materialized view."""
    tags = ["views", "image", "list"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_image_list_view_internal(
            conn=conn,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_image_list_get",
            request=http_request,
        )
