"""Tests entry GET endpoint."""

from datetime import datetime
from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetBenchmarkTestsViewSqlRow,
    GetTestsEntriesApiRequest,
    GetTestsEntriesApiResponse,
    GetTestsEntriesSqlParams,
    GetTestsEntriesSqlRow,
    QGetTestViewV4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/tests/get_tests_entries_complete.sql"
VIEW_SQL_PATH = "app/sql/v4/queries/views/benchmark/tests/get_test_view_complete.sql"

router = APIRouter()


async def get_tests_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch tests entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "tests"]
    cache_key_val = cache_key(
        "/api/v4/entries/tests/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetTestsEntriesSqlParams(ids=ids)
    result = cast(
        GetTestsEntriesSqlRow,
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


async def get_test_internal(
    conn: asyncpg.Connection,
    test_ids: list[UUID] | None = None,
    eval_id: UUID | None = None,
    eval_ids: list[UUID] | None = None,
    profile_id: UUID | None = None,
    archived: bool | None = None,
    department_ids: list[UUID] | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetBenchmarkTestsViewSqlRow:
    """Internal function for reading benchmark tests rows."""
    from app.sql.types import GetBenchmarkTestsViewSqlParams

    normalized_test_ids = test_ids or []
    cache_key_val = cache_key(
        "views/benchmark/tests/get",
        {
            "test_ids": [str(t) for t in normalized_test_ids],
            "eval_id": str(eval_id) if eval_id else None,
            "eval_ids": [str(e) for e in eval_ids] if eval_ids else None,
            "profile_id": str(profile_id) if profile_id else None,
            "archived": archived,
            "department_ids": [str(d) for d in department_ids]
            if department_ids
            else None,
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
            return GetBenchmarkTestsViewSqlRow.model_validate(cached)

    params = GetBenchmarkTestsViewSqlParams(
        test_ids=normalized_test_ids or None,
        eval_id_filter=eval_id,
        eval_ids_filter=eval_ids,
        profile_id_filter=profile_id,
        archived_filter=archived,
        department_ids_filter=department_ids,
        date_from_filter=date_from,
        date_to_filter=date_to,
        sort_by_field=sort_by,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    items: list[QGetTestViewV4Item] = list(result.items) if result and result.items else []
    total_count = result.total_count if result else 0

    response = GetBenchmarkTestsViewSqlRow(items=items, total_count=total_count or 0)

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "benchmark", "tests"],
    )

    return response


@router.post(
    "/tests/get",
    response_model=GetTestsEntriesApiResponse,
)
async def get_tests_entries(
    request: GetTestsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTestsEntriesApiResponse:
    """Get tests entries by IDs."""
    tags = ["entries", "tests"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_tests_entries_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetTestsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_tests_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
