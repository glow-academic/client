"""Problems entry GET endpoint."""

from datetime import datetime
from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db
from app.sql.types import (
    GetProblemListViewSqlRow,
    GetProblemsEntriesApiRequest,
    GetProblemsEntriesApiResponse,
    GetProblemsEntriesSqlParams,
    GetProblemsEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/problems/get_problems_entries_complete.sql"
VIEW_SQL_PATH = (
    "app/sql/queries/views/problem/list/get_problem_list_view_complete.sql"
)

router = APIRouter()


async def get_problem_list_view_internal(
    conn: asyncpg.Connection,
    profile_id_filter: UUID | None = None,
    resolved_filter: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetProblemListViewSqlRow:
    """Internal function for fetching problems data from MV."""
    from app.sql.types import GetProblemListViewSqlParams

    cache_key_val = cache_key(
        "views/problem/list/get",
        {
            "profile_id_filter": str(profile_id_filter) if profile_id_filter else None,
            "resolved_filter": resolved_filter,
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
            return GetProblemListViewSqlRow.model_validate(cached)

    params = GetProblemListViewSqlParams(
        profile_id_filter=profile_id_filter,
        resolved_filter=resolved_filter,
        date_from=date_from or datetime.min,
        date_to=date_to or datetime.max,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    response = GetProblemListViewSqlRow(
        items=list(result.items) if result and result.items else [],
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "problem", "list"],
    )

    return response


async def get_problems_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch problems entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "problems"]
    cache_key_val = cache_key(
        "/api/v5/entries/problems/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetProblemsEntriesSqlParams(ids=ids)
    result = cast(
        GetProblemsEntriesSqlRow,
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
    "/problems/get",
    response_model=GetProblemsEntriesApiResponse,
)
async def get_problems_entries(
    request: GetProblemsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProblemsEntriesApiResponse:
    """Get problems entries by IDs."""
    tags = ["entries", "problems"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_problems_entries_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetProblemsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_problems_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
