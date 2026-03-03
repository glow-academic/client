"""Test Invocation entry SEARCH endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db
from app.v5.sql.types import (
    SearchTestInvocationEntriesApiRequest,
    SearchTestInvocationEntriesApiResponse,
    SearchTestInvocationEntriesSqlParams,
    SearchTestInvocationEntriesSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/entries/test_invocation/search_test_invocation_entries_complete.sql"

router = APIRouter()


async def search_test_invocation_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    test_id: UUID | None = None,
    group_id: UUID | None = None,
    suite_department_id: UUID | None = None,
    grade_id: UUID | None = None,
    rubric_id: UUID | None = None,
    model_id: UUID | None = None,
    prompt_id: UUID | None = None,
    voice_id: UUID | None = None,
    temperature_level_id: UUID | None = None,
    reasoning_level_id: UUID | None = None,
    key_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search test_invocation entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "test_invocation"]
    cache_key_val = cache_key(
        "/api/v5/entries/test_invocation/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "test_id": str(test_id) if test_id else None,
            "group_id": str(group_id) if group_id else None,
            "suite_department_id": str(suite_department_id)
            if suite_department_id
            else None,
            "grade_id": str(grade_id) if grade_id else None,
            "rubric_id": str(rubric_id) if rubric_id else None,
            "model_id": str(model_id) if model_id else None,
            "prompt_id": str(prompt_id) if prompt_id else None,
            "voice_id": str(voice_id) if voice_id else None,
            "temperature_level_id": str(temperature_level_id)
            if temperature_level_id
            else None,
            "reasoning_level_id": str(reasoning_level_id)
            if reasoning_level_id
            else None,
            "key_id": str(key_id) if key_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchTestInvocationEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        test_id=test_id,
        group_id=group_id,
        suite_department_id=suite_department_id,
        grade_id=grade_id,
        rubric_id=rubric_id,
        model_id=model_id,
        prompt_id=prompt_id,
        voice_id=voice_id,
        temperature_level_id=temperature_level_id,
        reasoning_level_id=reasoning_level_id,
        key_id=key_id,
    )
    result = cast(
        SearchTestInvocationEntriesSqlRow,
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
    "/test_invocation/search",
    response_model=SearchTestInvocationEntriesApiResponse,
)
async def search_test_invocation_entries(
    request: SearchTestInvocationEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchTestInvocationEntriesApiResponse:
    """Search test_invocation entries."""
    tags = ["entries", "test_invocation"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_test_invocation_entries_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchTestInvocationEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_test_invocation_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
