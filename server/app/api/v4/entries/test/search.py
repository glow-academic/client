"""Test entry SEARCH endpoint."""

from datetime import datetime
from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetTestListViewSqlParams,
    GetTestListViewSqlRow,
    QGetTestListViewV4Option,
    SearchTestEntriesApiRequest,
    SearchTestEntriesApiResponse,
    SearchTestEntriesSqlParams,
    SearchTestEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/test/search_test_entries_complete.sql"
LIST_SQL_PATH = "app/sql/v4/queries/views/test/list/get_test_list_view_complete.sql"

router = APIRouter()


async def search_test_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    eval_id: UUID | None = None,
    profile_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search test entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "test"]
    cache_key_val = cache_key(
        "/api/v4/entries/test/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "eval_id": str(eval_id) if eval_id else None,
            "profile_id": str(profile_id) if profile_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchTestEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        eval_id=eval_id,
        profile_id=profile_id,
    )
    result = cast(
        SearchTestEntriesSqlRow,
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


# ---------------------------------------------------------------------------
# Internal: get test list
# ---------------------------------------------------------------------------


async def get_test_list_internal(
    conn: asyncpg.Connection,
    test_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    eval_ids: list[UUID] | None = None,
    is_archived_filter: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    search_text: str | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetTestListViewSqlRow:
    """Internal function for fetching test list data from test_mv."""
    cache_key_val = cache_key(
        "entries/test/list/get",
        {
            "test_ids": [str(t) for t in test_ids] if test_ids else None,
            "department_ids": [str(d) for d in department_ids]
            if department_ids
            else None,
            "eval_ids": [str(e) for e in eval_ids] if eval_ids else None,
            "is_archived_filter": is_archived_filter,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "search_text": search_text,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetTestListViewSqlRow.model_validate(cached)

    params = GetTestListViewSqlParams(
        test_ids=test_ids,
        department_ids=department_ids,
        eval_ids=eval_ids,
        is_archived_filter=is_archived_filter,
        date_from=date_from or datetime.min,
        date_to=date_to or datetime.max,
        search_text=search_text,
        sort_by_field=sort_by,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, LIST_SQL_PATH, params=params)

    # Filter out options with empty values
    eval_options: list[QGetTestListViewV4Option] | None = None
    if result and result.eval_options:
        eval_options = [opt for opt in result.eval_options if opt.value]

    response = GetTestListViewSqlRow(
        items=result.items if result else None,
        total_count=result.total_count or 0 if result else 0,
        eval_options=eval_options,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["entries", "test", "list"],
    )

    return response


# ---------------------------------------------------------------------------
# Router handler
# ---------------------------------------------------------------------------


@router.post(
    "/test/search",
    response_model=SearchTestEntriesApiResponse,
)
async def search_test_entries(
    request: SearchTestEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchTestEntriesApiResponse:
    """Search test entries."""
    tags = ["entries", "test"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_test_entries_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchTestEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_test_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
