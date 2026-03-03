"""Practice Training entry SEARCH endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db
from app.v5.sql.types import (
    SearchPracticeTrainingEntriesApiRequest,
    SearchPracticeTrainingEntriesApiResponse,
    SearchPracticeTrainingEntriesSqlParams,
    SearchPracticeTrainingEntriesSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/entries/practice_training/search_practice_training_entries_complete.sql"

router = APIRouter()


async def search_practice_training_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    practice_id: UUID | None = None,
    training_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search practice_training entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "practice_training"]
    cache_key_val = cache_key(
        "/api/v5/entries/practice_training/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "practice_id": str(practice_id) if practice_id else None,
            "training_id": str(training_id) if training_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchPracticeTrainingEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        practice_id=practice_id,
        training_id=training_id,
    )
    result = cast(
        SearchPracticeTrainingEntriesSqlRow,
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
    "/practice_training/search",
    response_model=SearchPracticeTrainingEntriesApiResponse,
)
async def search_practice_training_entries(
    request: SearchPracticeTrainingEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchPracticeTrainingEntriesApiResponse:
    """Search practice_training entries."""
    tags = ["entries", "practice_training"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_practice_training_entries_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchPracticeTrainingEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_practice_training_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
