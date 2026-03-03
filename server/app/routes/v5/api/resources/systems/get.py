"""Systems GET endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db
from app.sql.types import (
    GetSystemsApiRequest,
    GetSystemsApiResponse,
    GetSystemsSqlParams,
    GetSystemsSqlRow,
    QGetSystemsV4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/systems/get_systems_complete.sql"

router = APIRouter()


async def get_systems_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetSystemsV4Item]:
    """Internal function to fetch systems by IDs."""
    if not ids:
        return []

    tags = ["resources", "systems"]
    cache_key_val = cache_key(
        "/api/v5/resources/systems/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetSystemsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetSystemsSqlParams(ids=ids)
    result = cast(
        GetSystemsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetSystemsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/systems/get",
    response_model=GetSystemsApiResponse,
)
async def get_systems(
    request: GetSystemsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSystemsApiResponse:
    """Get systems resources by IDs."""
    tags = ["resources", "systems"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_systems_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetSystemsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_systems",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
