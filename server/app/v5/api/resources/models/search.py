"""Models SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import (
    QGetModelsV4Item,
    SearchModelsApiRequest,
    SearchModelsApiResponse,
    SearchModelsSqlParams,
    SearchModelsSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/v5/sql/queries/resources/models/search_models_complete.sql"

router = APIRouter()


async def search_models_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    provider_ids: list[UUID] | None = None,
    temperature_level_ids: list[UUID] | None = None,
    reasoning_level_ids: list[UUID] | None = None,
    quality_ids: list[UUID] | None = None,
    voice_ids: list[UUID] | None = None,
    modality_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    agent: bool = False,
    model: bool = False,
) -> list[QGetModelsV4Item]:
    """Internal function to search models."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "models"]
    cache_key_val = cache_key(
        "/api/v5/resources/models/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "department_ids": sorted(str(i) for i in (department_ids or [])),
            "provider_ids": sorted(str(i) for i in (provider_ids or [])),
            "temperature_level_ids": sorted(
                str(i) for i in (temperature_level_ids or [])
            ),
            "reasoning_level_ids": sorted(str(i) for i in (reasoning_level_ids or [])),
            "quality_ids": sorted(str(i) for i in (quality_ids or [])),
            "voice_ids": sorted(str(i) for i in (voice_ids or [])),
            "modality_ids": sorted(str(i) for i in (modality_ids or [])),
            "agent": agent,
            "model": model,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetModelsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchModelsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        department_ids=department_ids or [],
        provider_ids=provider_ids or [],
        temperature_level_ids=temperature_level_ids or [],
        reasoning_level_ids=reasoning_level_ids or [],
        quality_ids=quality_ids or [],
        voice_ids=voice_ids or [],
        modality_ids=modality_ids or [],
        agent=agent,
        model=model,
    )
    result = cast(
        SearchModelsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetModelsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/models/search",
    response_model=SearchModelsApiResponse,
)
async def search_models(
    request: SearchModelsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchModelsApiResponse:
    """Search models resources."""
    tags = ["resources", "models"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_models_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
            bypass_cache=bypass_cache,
            agent=request.agent or False,
            model=request.model or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchModelsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_models",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
