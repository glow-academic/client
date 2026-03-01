"""Standard Groups GET endpoint - v4 API.

Provides get endpoint for batch fetching standard_groups by IDs.
"""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.resources.standard_groups.types import (
    GetStandardGroupsApiRequest,
    GetStandardGroupsApiResponse,
)
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetStandardGroupsSqlParams,
    GetStandardGroupsSqlRow,
    QGetStandardGroupsV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

BATCH_SQL_PATH = (
    "app/sql/v4/queries/resources/standard_groups/get_standard_groups_complete.sql"
)

router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================


async def get_standard_groups_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetStandardGroupsV4Item]:
    """Internal function for batch fetching standard_groups by IDs.

    This is a simple fetch with active flag check.
    """
    if not ids:
        return []

    tags = ["resources", "standard_groups"]
    cache_key_val = cache_key(
        "/api/v4/resources/standard_groups/get-batch",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetStandardGroupsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetStandardGroupsSqlParams(p_ids=ids)
    result = cast(
        GetStandardGroupsSqlRow,
        await execute_sql_typed(conn, BATCH_SQL_PATH, params=params),
    )

    items: list[QGetStandardGroupsV4Item] = (
        result.items if result and result.items else []
    )

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
    "/standard_groups/get",
    response_model=GetStandardGroupsApiResponse,
)
async def get_standard_groups(
    request: GetStandardGroupsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetStandardGroupsApiResponse:
    """Get standard_groups by IDs."""
    tags = ["resources", "standard_groups"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        items = await get_standard_groups_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetStandardGroupsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_standard_groups",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
