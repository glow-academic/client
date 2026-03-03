"""Test Stop entry GET endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import (
    GetTestStopEntriesApiRequest,
    GetTestStopEntriesApiResponse,
    GetTestStopEntriesSqlParams,
    GetTestStopEntriesSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/entries/test_stop/get_test_stop_entries_complete.sql"

router = APIRouter()


async def get_test_stop_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch test_stop entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "test_stop"]
    cache_key_val = cache_key(
        "/api/v5/entries/test_stop/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetTestStopEntriesSqlParams(ids=ids)
    result = cast(
        GetTestStopEntriesSqlRow,
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


@router.post(
    "/test_stop/get",
    response_model=GetTestStopEntriesApiResponse,
)
async def get_test_stop_entries(
    request: GetTestStopEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTestStopEntriesApiResponse:
    """Get test_stop entries by IDs."""
    tags = ["entries", "test_stop"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_test_stop_entries_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetTestStopEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_test_stop_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
