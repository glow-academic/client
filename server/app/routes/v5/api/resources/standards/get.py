"""Standards GET endpoint - v4 API.

Provides get endpoint for batch fetching standards by IDs.
"""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.resources.standards.types import (
    GetStandardsApiRequest,
    GetStandardsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db
from app.sql.types import (
    GetStandardsSqlParams,
    GetStandardsSqlRow,
    QGetStandardsV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

BATCH_SQL_PATH = "app/sql/queries/resources/standards/get_standards_complete.sql"

router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================


async def get_standards_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetStandardsV4Item]:
    """Internal function for batch fetching standards by IDs.

    This is a simple fetch with active flag check.
    """
    if not ids:
        return []

    tags = ["resources", "standards"]
    cache_key_val = cache_key(
        "/api/v5/resources/standards/get-batch",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetStandardsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetStandardsSqlParams(p_ids=ids)
    result = cast(
        GetStandardsSqlRow,
        await execute_sql_typed(conn, BATCH_SQL_PATH, params=params),
    )

    items: list[QGetStandardsV4Item] = result.items if result and result.items else []

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
    "/standards/get",
    response_model=GetStandardsApiResponse,
)
async def get_standards(
    request: GetStandardsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetStandardsApiResponse:
    """Get standards by IDs."""
    tags = ["resources", "standards"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        items = await get_standards_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetStandardsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_standards",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
