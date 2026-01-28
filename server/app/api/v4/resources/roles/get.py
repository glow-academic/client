"""Roles GET endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from pydantic import BaseModel

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed
from fastapi import APIRouter, Depends, HTTPException, Request, Response

# Load SQL with types at module level
SQL_PATH = "app/sql/v4/queries/resources/roles/get_roles_complete.sql"


router = APIRouter()


# =============================================================================
# Types (defined locally since types.py is auto-generated)
# =============================================================================


class QGetRolesV4Item(BaseModel):
    """Role item returned from get endpoint."""

    role: str | None = None
    name: str | None = None
    description: str | None = None
    icon_value: str | None = None
    color_hex: str | None = None


class GetRolesApiRequest(BaseModel):
    """Request for getting all roles."""

    pass


class GetRolesApiResponse(BaseModel):
    """Response for getting roles."""

    items: list[QGetRolesV4Item] | None = None


class GetRolesSqlParams(BaseModel):
    """SQL parameters for get roles (no parameters)."""

    def to_tuple(self) -> tuple[Any, ...]:
        return ()


class GetRolesSqlRow(BaseModel):
    """SQL row for get roles."""

    items: list[QGetRolesV4Item] | None = None


# =============================================================================
# Internal Function
# =============================================================================


async def get_roles_internal(
    conn: asyncpg.Connection,
    bypass_cache: bool = False,
) -> list[QGetRolesV4Item]:
    """Internal function to fetch all roles.

    Can be called directly from other routes without HTTP overhead.
    """
    tags = ["resources", "roles"]
    cache_key_val = cache_key("/api/v4/resources/roles/get", {})

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [QGetRolesV4Item.model_validate(item) for item in cached.get("items", [])]

    # Execute SQL
    params = GetRolesSqlParams()
    result = cast(
        GetRolesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetRolesV4Item] = result.items if result and result.items else []

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
        items = await get_roles_internal(conn, bypass_cache)
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
