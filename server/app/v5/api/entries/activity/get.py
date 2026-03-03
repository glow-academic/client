"""Activity entry GET endpoint."""

from datetime import date
from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db
from app.sql.types import (
    GetActivityEntriesApiRequest,
    GetActivityEntriesApiResponse,
    GetActivityEntriesSqlParams,
    GetActivityEntriesSqlRow,
    GetActivityListViewSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/activity/get_activity_entries_complete.sql"
VIEW_SQL_PATH = (
    "app/sql/queries/views/activity/list/get_activity_list_view_complete.sql"
)

router = APIRouter()


async def get_activity_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch activity entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "activity"]
    cache_key_val = cache_key(
        "/api/v5/entries/activity/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetActivityEntriesSqlParams(ids=ids)
    result = cast(
        GetActivityEntriesSqlRow,
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


async def get_activity_list_view_internal(
    conn: asyncpg.Connection,
    profile_id_filter: UUID | None = None,
    session_id_filter: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page_limit: int = 10000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetActivityListViewSqlRow:
    """Internal function for fetching activity data from MV."""
    from app.sql.types import GetActivityListViewSqlParams

    cache_key_val = cache_key(
        "views/activity/list/get",
        {
            "profile_id_filter": str(profile_id_filter) if profile_id_filter else None,
            "session_id_filter": str(session_id_filter) if session_id_filter else None,
            "date_from": str(date_from) if date_from else None,
            "date_to": str(date_to) if date_to else None,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetActivityListViewSqlRow.model_validate(cached)

    params = GetActivityListViewSqlParams(
        profile_id_filter=profile_id_filter,
        session_id_filter=session_id_filter,
        date_from=date_from,
        date_to=date_to,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    response = GetActivityListViewSqlRow(
        items=list(result.items) if result and result.items else [],
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "activity", "list"],
    )

    return response


@router.post(
    "/activity/get",
    response_model=GetActivityEntriesApiResponse,
)
async def get_activity_entries(
    request: GetActivityEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetActivityEntriesApiResponse:
    """Get activity entries by IDs."""
    tags = ["entries", "activity"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_activity_entries_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetActivityEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_activity_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
