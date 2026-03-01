"""Roles GET endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.resources.roles.types import (
    GetRolesApiRequest,
    GetRolesApiResponse,
    GetRolesSqlParams,
    GetRolesSqlRow,
    QGetRolesV4Item,
)
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/v4/queries/resources/roles/get_roles_complete.sql"

router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================


async def get_roles_internal(
    conn: asyncpg.Connection,
    ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> list[QGetRolesV4Item]:
    """Internal function to fetch roles by IDs (empty/None = all).

    Can be called directly from other routes without HTTP overhead.
    """
    effective_ids = ids or []
    if not effective_ids:
        return []
    tags = ["resources", "roles"]
    cache_key_val = cache_key(
        "/api/v4/resources/roles/get",
        {"ids": sorted(str(i) for i in effective_ids)},
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetRolesV4Item.model_validate(item) for item in cached.get("items", [])
            ]

    # Execute SQL
    params = GetRolesSqlParams(ids=effective_ids)
    result = cast(
        GetRolesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetRolesV4Item] = (
        [
            QGetRolesV4Item.model_validate(
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
        ttl=300,  # Roles change infrequently, cache longer
        tags=tags,
    )

    return items


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/roles/get",
    response_model=GetRolesApiResponse,
)
async def get_roles(
    request: GetRolesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetRolesApiResponse:
    """Get all roles.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "roles"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_roles_internal(conn, request.ids or [], bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetRolesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_roles",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
