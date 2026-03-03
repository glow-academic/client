"""Model rubrics get endpoint - v4 API.

Provides get endpoint for fetching model rubrics by resource IDs.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db
from app.sql.types import (
    GetModelRubricsApiRequest,
    GetModelRubricsApiResponse,
    GetModelRubricsSqlParams,
    GetModelRubricsSqlRow,
    QGetModelRubricsV4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/model_rubrics/get_model_rubrics_complete.sql"

router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================


async def get_model_rubrics_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetModelRubricsV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        ids: List of model rubric resource IDs
        bypass_cache: Whether to bypass cache

    Returns:
        List of model rubric items
    """
    if not ids:
        return []

    # Generate cache key
    cache_key_val = cache_key(
        "model_rubrics/get",
        {
            "ids": sorted([str(id) for id in ids]),
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
    params = GetModelRubricsSqlParams(ids=ids)
    result = cast(
        GetModelRubricsSqlRow,
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
    "/model_rubrics/get",
    response_model=GetModelRubricsApiResponse,
)
async def get_model_rubrics(
    request: GetModelRubricsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetModelRubricsApiResponse:
    """Get model rubrics by resource IDs."""
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

        items = await get_model_rubrics_internal(
            conn=conn,
            ids=request.ids or [],
            bypass_cache=bypass_cache,
        )

        api_response = GetModelRubricsApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_model_rubrics",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
