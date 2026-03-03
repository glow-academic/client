"""Arg positions GET endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import (
    GetArgPositionsApiRequest,
    GetArgPositionsApiResponse,
    GetArgPositionsSqlParams,
    GetArgPositionsSqlRow,
    QGetArgPositionsV4Item,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/resources/arg_positions/get_arg_positions_complete.sql"

router = APIRouter()


async def get_arg_positions_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetArgPositionsV4Item]:
    """Internal function to fetch arg_positions by IDs."""
    if not ids:
        return []

    tags = ["resources", "arg_positions"]
    cache_key_val = cache_key(
        "/api/v5/resources/arg_positions/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetArgPositionsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetArgPositionsSqlParams(ids=ids)
    result = cast(
        GetArgPositionsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetArgPositionsV4Item] = (
        result.items if result and result.items else []
    )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/arg_positions/get",
    response_model=GetArgPositionsApiResponse,
)
async def get_arg_positions(
    request: GetArgPositionsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetArgPositionsApiResponse:
    """Get arg_positions resources by IDs."""
    tags = ["resources", "arg_positions"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_arg_positions_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetArgPositionsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_arg_positions",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
