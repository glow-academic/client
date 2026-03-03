"""Values SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db
from app.v5.sql.types import (
    QGetValuesV4Item,
    SearchValuesApiRequest,
    SearchValuesApiResponse,
    SearchValuesSqlParams,
    SearchValuesSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/resources/values/search_values_complete.sql"

router = APIRouter()


async def search_values_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    suggest_source: str | None = None,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    model: bool = False,
    provider: bool = False,
) -> list[QGetValuesV4Item]:
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "values"]
    cache_key_val = cache_key(
        "/api/v5/resources/values/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "suggest_source": suggest_source,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "model": model,
            "provider": provider,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetValuesV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchValuesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        suggest_source=suggest_source,
        exclude_ids=exclude_ids or [],
        model=model,
        provider=provider,
    )
    result = cast(
        SearchValuesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetValuesV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/values/search",
    response_model=SearchValuesApiResponse,
)
async def search_values(
    request: SearchValuesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchValuesApiResponse:
    tags = ["resources", "values"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_values_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.suggest_source,
            request.exclude_ids,
            bypass_cache,
            model=request.model or False,
            provider=request.provider or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchValuesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_values",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
