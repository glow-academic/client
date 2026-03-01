"""Model rubrics search endpoint - v4 API.

Provides search endpoint for finding available model rubrics for models.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    QGetModelRubricsV4Item,
    SearchModelRubricsApiRequest,
    SearchModelRubricsApiResponse,
    SearchModelRubricsSqlParams,
    SearchModelRubricsSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/resources/model_rubrics/search_model_rubrics_complete.sql"
)

router = APIRouter()


async def search_model_rubrics_internal(
    conn: asyncpg.Connection,
    model_ids: list[UUID],
    rubric_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    eval: bool = False,
) -> list[QGetModelRubricsV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        model_ids: List of model IDs to search rubrics for
        bypass_cache: Whether to bypass cache

    Returns:
        List of available model rubric items
    """
    # Generate cache key
    cache_key_val = cache_key(
        "model_rubrics/search",
        {
            "model_ids": sorted([str(id) for id in model_ids]),
            "rubric_ids": sorted(str(i) for i in (rubric_ids or [])),
            "eval": eval,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetModelRubricsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = SearchModelRubricsSqlParams(
        model_ids=model_ids or [],
        rubric_ids=rubric_ids or [],
        eval=eval,
    )
    result = cast(
        SearchModelRubricsSqlRow,
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
        tags=["model_rubrics"],
    )

    return items


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/model_rubrics/search",
    response_model=SearchModelRubricsApiResponse,
)
async def search_model_rubrics(
    request: SearchModelRubricsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchModelRubricsApiResponse:
    """Search available model rubrics for models."""
    tags = ["resources", "model_rubrics"]

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

        items = await search_model_rubrics_internal(
            conn=conn,
            model_ids=request.model_ids or [],
            bypass_cache=bypass_cache,
            eval=request.eval or False,
        )

        api_response = SearchModelRubricsApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_model_rubrics",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
