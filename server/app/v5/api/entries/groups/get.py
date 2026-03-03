"""Groups entry GET endpoint."""

from datetime import datetime
from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import (
    GetGroupListViewSqlRow,
    GetGroupsEntriesApiRequest,
    GetGroupsEntriesApiResponse,
    GetGroupsEntriesSqlParams,
    GetGroupsEntriesSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/entries/groups/get_groups_entries_complete.sql"
VIEW_SQL_PATH = "app/v5/sql/queries/views/group/list/get_group_list_view_complete.sql"

router = APIRouter()


async def get_groups_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch groups entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "groups"]
    cache_key_val = cache_key(
        "/api/v5/entries/groups/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetGroupsEntriesSqlParams(ids=ids)
    result = cast(
        GetGroupsEntriesSqlRow,
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


async def get_group_list_view_internal(
    conn: asyncpg.Connection,
    group_ids: list[UUID] | None = None,
    session_id_filter: UUID | None = None,
    session_ids: list[UUID] | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetGroupListViewSqlRow:
    """Internal function for fetching groups data from MV."""
    from app.v5.sql.types import GetGroupListViewSqlParams

    cache_key_val = cache_key(
        "views/group/list/get",
        {
            "group_ids": [str(g) for g in group_ids] if group_ids else None,
            "session_id_filter": str(session_id_filter) if session_id_filter else None,
            "session_ids": [str(s) for s in session_ids] if session_ids else None,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetGroupListViewSqlRow.model_validate(cached)

    params = GetGroupListViewSqlParams(
        group_ids=group_ids,
        session_id_filter=session_id_filter,
        session_ids=session_ids,
        date_from=date_from or datetime.min,
        date_to=date_to or datetime.max,
        sort_by_field=sort_by,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    response = GetGroupListViewSqlRow(
        items=list(result.items) if result and result.items else [],
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "group", "list"],
    )

    return response


@router.post(
    "/groups/get",
    response_model=GetGroupsEntriesApiResponse,
)
async def get_groups_entries(
    request: GetGroupsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetGroupsEntriesApiResponse:
    """Get groups entries by IDs."""
    tags = ["entries", "groups"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_groups_entries_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetGroupsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_groups_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
