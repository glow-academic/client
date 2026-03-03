"""Modalities GET endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db
from app.sql.types import (
    GetModalitiesApiRequest,
    GetModalitiesApiResponse,
    GetModalitiesSqlParams,
    GetModalitiesSqlRow,
    QGetModalitiesV4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/modalities/get_modalities_complete.sql"

router = APIRouter()


async def get_modalities_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetModalitiesV4Item]:
    """Internal function to fetch modalities by IDs."""
    if not ids:
        return []

    tags = ["resources", "modalities"]
    cache_key_val = cache_key(
        "/api/v5/resources/modalities/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetModalitiesV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetModalitiesSqlParams(ids=ids)
    result = cast(
        GetModalitiesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetModalitiesV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/modalities/get",
    response_model=GetModalitiesApiResponse,
)
async def get_modalities(
    request: GetModalitiesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetModalitiesApiResponse:
    """Get modalities resources by IDs."""
    tags = ["resources", "modalities"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_modalities_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetModalitiesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_modalities",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
