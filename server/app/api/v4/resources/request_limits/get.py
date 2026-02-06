"""Request Limits GET endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetRequestLimitsApiRequest,
    GetRequestLimitsApiResponse,
    GetRequestLimitsSqlParams,
    GetRequestLimitsSqlRow,
    QGetRequestLimitsV4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/request_limits/get_request_limits_complete.sql"

router = APIRouter()


async def get_request_limits_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetRequestLimitsV4Item]:
    """Internal function to fetch request_limits by IDs."""
    if not ids:
        return []

    tags = ["resources", "request_limits"]
    cache_key_val = cache_key(
        "/api/v4/resources/request_limits/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetRequestLimitsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetRequestLimitsSqlParams(ids=ids)
    result = cast(
        GetRequestLimitsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetRequestLimitsV4Item] = (
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
    "/request_limits/get",
    response_model=GetRequestLimitsApiResponse,
)
async def get_request_limits(
    request: GetRequestLimitsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetRequestLimitsApiResponse:
    """Get request_limits resources by IDs."""
    tags = ["resources", "request_limits"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_request_limits_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetRequestLimitsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_request_limits",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
