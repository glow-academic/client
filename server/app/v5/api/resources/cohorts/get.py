"""Cohorts GET endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.resources.cohorts.types import (
    GetCohortsApiRequest,
    GetCohortsApiResponse,
    GetCohortsSqlParams,
    GetCohortsSqlRow,
    QGetCohortsV4Item,
)
from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/v5/sql/queries/resources/cohorts/get_cohorts_complete.sql"

router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================


async def get_cohorts_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetCohortsV4Item]:
    """Internal function to fetch cohorts by IDs.

    Can be called directly from other routes without HTTP overhead.
    """
    if not ids:
        return []

    tags = ["resources", "cohorts"]
    cache_key_val = cache_key(
        "/api/v5/resources/cohorts/get",
        {"ids": [str(id) for id in ids]},
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetCohortsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    # Execute SQL
    params = GetCohortsSqlParams(ids=ids)
    result = cast(
        GetCohortsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetCohortsV4Item] = (
        [
            QGetCohortsV4Item.model_validate(
                item.model_dump() if hasattr(item, "model_dump") else item
            )
            for item in (result.items or [])
        ]
        if result
        else []
    )

    # Cache result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/cohorts/get",
    response_model=GetCohortsApiResponse,
)
async def get_cohorts(
    request: GetCohortsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetCohortsApiResponse:
    """Get cohorts resources by IDs.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "cohorts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_cohorts_internal(conn, request.ids or [], bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetCohortsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_cohorts",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
