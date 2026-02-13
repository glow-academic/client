"""Models SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    QGetModelsV4Item,
    SearchModelsApiRequest,
    SearchModelsApiResponse,
    SearchModelsSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/v4/queries/resources/models/search_models_complete.sql"

router = APIRouter()


# Handcrafted params to match SQL signature with artifact boolean filters
class SearchModelsParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    # Artifact boolean filters
    agent: bool = False
    model: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.agent,
            self.model,
        )


async def search_models_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
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
        "/api/v4/resources/models/search",
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
                QGetModelsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchModelsParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
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
            bypass_cache,
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
