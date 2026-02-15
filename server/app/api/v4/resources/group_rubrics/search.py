"""Group rubrics SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    QGetGroupRubricsV4Item,
    SearchGroupRubricsApiRequest,
    SearchGroupRubricsApiResponse,
    SearchGroupRubricsSqlParams,
    SearchGroupRubricsSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = (
    "app/sql/v4/queries/resources/group_rubrics/search_group_rubrics_complete.sql"
)

router = APIRouter()


async def search_group_rubrics_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    groups_ids: list[UUID] | None = None,
    rubric_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    eval: bool = False,
) -> list[QGetGroupRubricsV4Item]:
    """Internal function to search group_rubrics."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "group_rubrics"]
    cache_key_val = cache_key(
        "/api/v4/resources/group_rubrics/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "groups_ids": sorted(str(i) for i in (groups_ids or [])),
            "rubric_ids": sorted(str(i) for i in (rubric_ids or [])),
            "eval": eval,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetGroupRubricsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchGroupRubricsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        groups_ids=groups_ids or [],
        rubric_ids=rubric_ids or [],
        eval=eval,
    )
    result = cast(
        SearchGroupRubricsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetGroupRubricsV4Item] = (
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
    "/group_rubrics/search",
    response_model=SearchGroupRubricsApiResponse,
)
async def search_group_rubrics(
    request: SearchGroupRubricsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchGroupRubricsApiResponse:
    """Search group_rubrics resources."""
    tags = ["resources", "group_rubrics"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_group_rubrics_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
            bypass_cache=bypass_cache,
            eval=request.eval or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchGroupRubricsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_group_rubrics",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
