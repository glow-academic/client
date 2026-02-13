"""Settings GET endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.resources.settings.types import (
    GetSettingsApiRequest,
    GetSettingsApiResponse,
    GetSettingsSqlParams,
    GetSettingsSqlRow,
    QGetSettingsV4Item,
)
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/v4/queries/resources/settings/get_settings_complete.sql"


router = APIRouter()


# =============================================================================
# Internal Function
# =============================================================================


async def get_settings_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetSettingsV4Item]:
    """Internal function to fetch settings by IDs.

    Can be called directly from other routes without HTTP overhead.
    """
    if not ids:
        return []

    tags = ["resources", "settings"]
    cache_key_val = cache_key(
        "/api/v4/resources/settings/get",
        {"ids": sorted(str(i) for i in ids)},
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetSettingsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    # Execute SQL
    params = GetSettingsSqlParams(ids=ids)
    result = cast(
        GetSettingsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetSettingsV4Item] = result.items if result and result.items else []

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
    "/settings/get",
    response_model=GetSettingsApiResponse,
)
async def get_settings(
    request: GetSettingsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSettingsApiResponse:
    """Get settings resources by IDs.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "settings"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_settings_internal(conn, request.ids or [], bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetSettingsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_settings",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
