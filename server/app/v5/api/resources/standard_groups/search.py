"""Standard groups SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db
from app.v5.sql.types import (
    QGetStandardGroupsV4Item,
    SearchStandardGroupsApiRequest,
    SearchStandardGroupsApiResponse,
    SearchStandardGroupsSqlParams,
    SearchStandardGroupsSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = (
    "app/v5/sql/queries/resources/standard_groups/search_standard_groups_complete.sql"
)

router = APIRouter()


async def search_standard_groups_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    rubric: bool = False,
) -> list[QGetStandardGroupsV4Item]:
    """Internal function to search standard_groups."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "standard_groups"]
    cache_key_val = cache_key(
        "/api/v5/resources/standard_groups/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "rubric": rubric,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetStandardGroupsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchStandardGroupsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        rubric=rubric,
    )
    result = cast(
        SearchStandardGroupsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetStandardGroupsV4Item] = (
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
    "/standard_groups/search",
    response_model=SearchStandardGroupsApiResponse,
)
async def search_standard_groups(
    request: SearchStandardGroupsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchStandardGroupsApiResponse:
    """Search standard_groups resources."""
    tags = ["resources", "standard_groups"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_standard_groups_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
            bypass_cache,
            rubric=request.rubric or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchStandardGroupsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_standard_groups",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
