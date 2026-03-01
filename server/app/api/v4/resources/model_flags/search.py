"""Model flags search endpoint - v4 API.

Provides search endpoint for finding available model flags for models.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    QGetModelFlagsV4Item,
    SearchModelFlagsApiRequest,
    SearchModelFlagsApiResponse,
    SearchModelFlagsSqlParams,
    SearchModelFlagsSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/resources/model_flags/search_model_flags_complete.sql"
)


router = APIRouter()


async def search_model_flags_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    model_ids: list[UUID] | None = None,
    flag_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    eval: bool = False,
) -> list[QGetModelFlagsV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        search: Text search filter
        limit_count: Max results to return
        offset_count: Offset for pagination
        exclude_ids: IDs to exclude from results
        model_ids: List of model IDs to search flags for (empty = all models)
        bypass_cache: Whether to bypass cache

    Returns:
        List of available model flag items
    """
    effective_model_ids = model_ids or []
    effective_exclude_ids = exclude_ids or []

    # Generate cache key
    cache_key_val = cache_key(
        "model_flags/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": sorted(str(i) for i in effective_exclude_ids),
            "model_ids": sorted(str(i) for i in effective_model_ids),
            "flag_ids": sorted(str(i) for i in (flag_ids or [])),
            "eval": eval,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetModelFlagsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = SearchModelFlagsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=effective_exclude_ids,
        model_ids=effective_model_ids,
        flag_ids=flag_ids or [],
        eval=eval,
    )
    result = cast(
        SearchModelFlagsSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH,
            params=params,
        ),
    )

    items = result.items or []

    # Cache response
    await set_cached(
        cache_key_val,
        {"data": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["model_flags"],
    )

    return items


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/model_flags/search",
    response_model=SearchModelFlagsApiResponse,
)
async def search_model_flags(
    request: SearchModelFlagsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchModelFlagsApiResponse:
    """Search available model flags for models."""
    tags = ["resources", "model_flags"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        items = await search_model_flags_internal(
            conn=conn,
            search=request.search if hasattr(request, "search") else None,
            limit_count=request.limit_count if hasattr(request, "limit_count") else 20,
            offset_count=request.offset_count
            if hasattr(request, "offset_count")
            else 0,
            exclude_ids=request.exclude_ids if hasattr(request, "exclude_ids") else [],
            model_ids=request.model_ids or [],
            bypass_cache=bypass_cache,
            eval=request.eval or False,
        )

        api_response = SearchModelFlagsApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_model_flags",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
