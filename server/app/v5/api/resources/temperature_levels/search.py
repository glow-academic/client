"""Temperature Levels SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import (
    QGetTemperatureLevelsV4Item,
    SearchTemperatureLevelsApiRequest,
    SearchTemperatureLevelsApiResponse,
    SearchTemperatureLevelsSqlParams,
    SearchTemperatureLevelsSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/v5/sql/queries/resources/temperature_levels/search_temperature_levels_complete.sql"

router = APIRouter()


async def search_temperature_levels_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    agent: bool = False,
    model: bool = False,
) -> list[QGetTemperatureLevelsV4Item]:
    """Internal function to search temperature levels."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "temperature_levels"]
    cache_key_val = cache_key(
        "/api/v5/resources/temperature_levels/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "agent": agent,
            "model": model,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetTemperatureLevelsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchTemperatureLevelsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        agent=agent,
        model=model,
    )
    result = cast(
        SearchTemperatureLevelsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetTemperatureLevelsV4Item] = (
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
    "/temperature_levels/search",
    response_model=SearchTemperatureLevelsApiResponse,
)
async def search_temperature_levels(
    request: SearchTemperatureLevelsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchTemperatureLevelsApiResponse:
    """Search temperature_levels resources."""
    tags = ["resources", "temperature_levels"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_temperature_levels_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
            bypass_cache,
            agent=request.agent or False,
            model=request.model or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchTemperatureLevelsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_temperature_levels",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
