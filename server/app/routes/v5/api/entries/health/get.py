"""Health entry GET endpoint."""

from datetime import datetime
from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db
from app.sql.types import (
    GetHealthEntriesApiRequest,
    GetHealthEntriesApiResponse,
    GetHealthEntriesSqlParams,
    GetHealthEntriesSqlRow,
    GetHealthListViewSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/health/get_health_entries_complete.sql"
VIEW_SQL_PATH = "app/sql/queries/views/health/list/get_health_list_view_complete.sql"

router = APIRouter()


async def get_health_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch health entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "health"]
    cache_key_val = cache_key(
        "/api/v5/entries/health/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetHealthEntriesSqlParams(ids=ids)
    result = cast(
        GetHealthEntriesSqlRow,
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


async def get_health_list_view_internal(
    conn: asyncpg.Connection,
    service_filter: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_order: str = "desc",
    page_limit: int = 1000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetHealthListViewSqlRow:
    """Internal function for fetching health data from MV."""
    from app.sql.types import GetHealthListViewSqlParams

    cache_key_val = cache_key(
        "views/health/list/get",
        {
            "service_filter": service_filter,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetHealthListViewSqlRow.model_validate(cached)

    params = GetHealthListViewSqlParams(
        service_filter=service_filter,
        date_from=date_from or datetime.min,
        date_to=date_to or datetime.max,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    response = GetHealthListViewSqlRow(
        items=list(result.items) if result and result.items else [],
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "health", "list"],
    )

    return response


@router.post(
    "/health/get",
    response_model=GetHealthEntriesApiResponse,
)
async def get_health_entries(
    request: GetHealthEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHealthEntriesApiResponse:
    """Get health entries by IDs."""
    tags = ["entries", "health"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_health_entries_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetHealthEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_health_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
