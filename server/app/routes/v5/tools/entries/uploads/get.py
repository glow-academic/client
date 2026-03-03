"""uploads/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetUploadListViewSqlRow,
    GetUploadsEntriesSqlParams,
    GetUploadsEntriesSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/uploads/get_uploads_entries_complete.sql"

VIEW_SQL_PATH = "app/sql/queries/views/upload/list/get_upload_list_view_complete.sql"

async def get_uploads_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch uploads entries by IDs (metadata)."""
    if not ids:
        return []

    tags = ["entries", "uploads"]
    cache_key_val = cache_key(
        "/api/v5/entries/uploads/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetUploadsEntriesSqlParams(ids=ids)
    result = cast(
        GetUploadsEntriesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
    )

    return items

async def get_upload_list_view_internal(
    conn: asyncpg.Connection,
    uploads_id_filter: UUID | None = None,
    page_limit: int = 10000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetUploadListViewSqlRow:
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
            return GetUploadListViewSqlRow.model_validate(cached)

    params = GetUploadListViewSqlParams(
        uploads_id_filter=uploads_id_filter,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    response = GetUploadListViewSqlRow(
        items=list(result.items) if result and result.items else [],
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "upload", "list"],
    )

    return response
