"""Grants entry SEARCH endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    SearchGrantsEntriesApiRequest,
    SearchGrantsEntriesApiResponse,
    SearchGrantsEntriesSqlParams,
    SearchGrantsEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/grants/search_grants_entries_complete.sql"

router = APIRouter()


async def search_grants_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    grantor_id: UUID | None = None,
    emulation_id: UUID | None = None,
    emulated_id: UUID | None = None,
    grant_session_id: UUID | None = None,
    emulation_session_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search grants entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "grants"]
    cache_key_val = cache_key(
        "/api/v4/entries/grants/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "grantor_id": str(grantor_id) if grantor_id else None,
            "emulation_id": str(emulation_id) if emulation_id else None,
            "emulated_id": str(emulated_id) if emulated_id else None,
            "grant_session_id": str(grant_session_id) if grant_session_id else None,
            "emulation_session_id": str(emulation_session_id)
            if emulation_session_id
            else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchGrantsEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        grantor_id=grantor_id,
        emulation_id=emulation_id,
        emulated_id=emulated_id,
        grant_session_id=grant_session_id,
        emulation_session_id=emulation_session_id,
    )
    result = cast(
        SearchGrantsEntriesSqlRow,
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
    "/grants/search",
    response_model=SearchGrantsEntriesApiResponse,
)
async def search_grants_entries(
    request: SearchGrantsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchGrantsEntriesApiResponse:
    """Search grants entries."""
    tags = ["entries", "grants"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_grants_entries_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchGrantsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_grants_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
