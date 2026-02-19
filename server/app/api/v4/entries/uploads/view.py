"""View wrapper for uploads list entries."""

from datetime import datetime
from uuid import UUID

import asyncpg
from pydantic import BaseModel, Field

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/upload/list/get_upload_list_view_complete.sql"


class UploadViewItem(BaseModel):
    """Single item from the uploads list view."""

    uploads_id: UUID
    upload_id: UUID
    file_path: str | None = None
    mime_type: str | None = None
    size: int | None = None
    created_at: datetime | None = None


class GetUploadListViewResponse(BaseModel):
    """Response containing uploads list data."""

    items: list[UploadViewItem] = Field(default_factory=list)
    total_count: int = Field(default=0)


async def get_upload_list_view_internal(
    conn: asyncpg.Connection,
    uploads_id_filter: UUID | None = None,
    page_limit: int = 10000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetUploadListViewResponse:
    """Internal function for fetching uploads data from MV."""
    from app.sql.types import GetUploadListViewSqlParams

    cache_key_val = cache_key(
        "views/upload/list/get",
        {
            "uploads_id_filter": str(uploads_id_filter) if uploads_id_filter else None,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetUploadListViewResponse.model_validate(cached)

    params = GetUploadListViewSqlParams(
        uploads_id_filter=uploads_id_filter,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[UploadViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                UploadViewItem(
                    uploads_id=item.uploads_id,
                    upload_id=item.upload_id,
                    file_path=item.file_path,
                    mime_type=item.mime_type,
                    size=item.size,
                    created_at=item.created_at,
                )
            )

    response = GetUploadListViewResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "upload", "list"],
    )

    return response
