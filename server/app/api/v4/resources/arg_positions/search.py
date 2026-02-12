"""Arg positions SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    QGetArgPositionsV4Item,
    SearchArgPositionsApiRequest,
    SearchArgPositionsApiResponse,
    SearchArgPositionsSqlParams,
    SearchArgPositionsSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/arg_positions/search_arg_positions_complete.sql"

router = APIRouter()


async def search_arg_positions_internal(
    conn: asyncpg.Connection,
    tool_id: UUID | None = None,
    args_ids: list[UUID] | None = None,
    limit_count: int | None = 100,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> list[QGetArgPositionsV4Item]:
    """Internal function to search arg_positions."""
    tags = ["resources", "arg_positions"]
    cache_key_val = cache_key(
        "/api/v4/resources/arg_positions/search",
        {
            "tool_id": str(tool_id) if tool_id else None,
            "args_ids": [str(id) for id in (args_ids or [])],
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetArgPositionsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchArgPositionsSqlParams(
        tool_id=tool_id,
        args_ids=args_ids or [],
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
    )
    result = cast(
        SearchArgPositionsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetArgPositionsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/arg_positions/search",
    response_model=SearchArgPositionsApiResponse,
)
async def search_arg_positions(
    request: SearchArgPositionsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchArgPositionsApiResponse:
    """Search arg_positions resources."""
    tags = ["resources", "arg_positions"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_arg_positions_internal(
            conn,
            request.tool_id,
            request.args_ids,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
            bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchArgPositionsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_arg_positions",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
