"""Modalities SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db
from app.sql.types import (
    QGetModalitiesV4Item,
    SearchModalitiesApiRequest,
    SearchModalitiesApiResponse,
    SearchModalitiesSqlParams,
    SearchModalitiesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/modalities/search_modalities_complete.sql"

router = APIRouter()


async def search_modalities_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    modality: str | None = None,
    is_input: bool | None = None,
    bypass_cache: bool = False,
    *,
    model: bool = False,
) -> list[QGetModalitiesV4Item]:
    """Internal function to search modalities."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "modalities"]
    cache_key_val = cache_key(
        "/api/v5/resources/modalities/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "modality": modality,
            "is_input": is_input,
            "model": model,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetModalitiesV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchModalitiesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        modality=modality,
        is_input=is_input,
        model=model,
    )
    result = cast(
        SearchModalitiesSqlRow,
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
    "/modalities/search",
    response_model=SearchModalitiesApiResponse,
)
async def search_modalities(
    request: SearchModalitiesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchModalitiesApiResponse:
    """Search modalities resources."""
    tags = ["resources", "modalities"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_modalities_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
            bypass_cache=bypass_cache,
            model=request.model or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchModalitiesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_modalities",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
