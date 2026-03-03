"""Endpoints SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db
from app.v5.sql.types import (
    QGetEndpointsV4Item,
    SearchEndpointsApiRequest,
    SearchEndpointsApiResponse,
    SearchEndpointsSqlParams,
    SearchEndpointsSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/v5/sql/queries/resources/endpoints/search_endpoints_complete.sql"

router = APIRouter()


async def search_endpoints_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    provider: bool = False,
) -> list[QGetEndpointsV4Item]:
    """Internal function to search endpoints."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "endpoints"]
    cache_key_val = cache_key(
        "/api/v5/resources/endpoints/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "provider": provider,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetEndpointsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchEndpointsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        provider=provider,
    )
    result = cast(
        SearchEndpointsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetEndpointsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/endpoints/search",
    response_model=SearchEndpointsApiResponse,
)
async def search_endpoints(
    request: SearchEndpointsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchEndpointsApiResponse:
    """Search endpoints resources."""
    tags = ["resources", "endpoints"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_endpoints_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
            bypass_cache,
            provider=request.provider or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchEndpointsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_endpoints",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
