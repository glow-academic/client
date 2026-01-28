"""Names SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    QGetNamesV4Item,
    SearchNamesApiRequest,
    SearchNamesApiResponse,
    SearchNamesSqlParams,
    SearchNamesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed
from fastapi import APIRouter, Depends, HTTPException, Request, Response

# Load SQL with types at module level
SQL_PATH = "app/sql/v4/queries/resources/names/search_names_complete.sql"

router = APIRouter()


async def search_names_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    group_id: UUID | None = None,
    suggest_source: str | None = None,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> list[QGetNamesV4Item]:
    """Internal function to search names."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "names"]
    cache_key_val = cache_key(
        "/api/v4/resources/names/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "group_id": str(group_id) if group_id else None,
            "suggest_source": suggest_source,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [QGetNamesV4Item.model_validate(item) for item in cached.get("items", [])]

    params = SearchNamesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        group_id=group_id,
        suggest_source=suggest_source,
        exclude_ids=exclude_ids or [],
    )
    result = cast(
        SearchNamesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetNamesV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/names/search",
    response_model=SearchNamesApiResponse,
)
async def search_names(
    request: SearchNamesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchNamesApiResponse:
    """Search names resources."""
    tags = ["resources", "names"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_names_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.group_id,
            request.suggest_source,
            request.exclude_ids,
            bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchNamesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_names",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
