"""Attempt entry SEARCH endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    SearchAttemptEntriesApiRequest,
    SearchAttemptEntriesApiResponse,
    SearchAttemptEntriesSqlParams,
    SearchAttemptEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/attempt/search_attempt_entries_complete.sql"

router = APIRouter()


async def search_attempt_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    simulation_id: UUID | None = None,
    profile_id: UUID | None = None,
    cohort_id: UUID | None = None,
    department_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search attempt entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "attempt"]
    cache_key_val = cache_key(
        "/api/v4/entries/attempt/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "simulation_id": str(simulation_id) if simulation_id else None,
            "profile_id": str(profile_id) if profile_id else None,
            "cohort_id": str(cohort_id) if cohort_id else None,
            "department_id": str(department_id) if department_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchAttemptEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        simulation_id=simulation_id,
        profile_id=profile_id,
        cohort_id=cohort_id,
        department_id=department_id,
    )
    result = cast(
        SearchAttemptEntriesSqlRow,
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
    "/attempt/search",
    response_model=SearchAttemptEntriesApiResponse,
)
async def search_attempt_entries(
    request: SearchAttemptEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchAttemptEntriesApiResponse:
    """Search attempt entries."""
    tags = ["entries", "attempt"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_attempt_entries_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchAttemptEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_attempt_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
