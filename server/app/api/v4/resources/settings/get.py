"""Settings GET endpoint - v4 API following DHH principles."""

from datetime import datetime
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/v4/queries/settings/get_settings_resource_data_complete.sql"


router = APIRouter()


# =============================================================================
# Types (defined locally since types.py is auto-generated)
# =============================================================================


class QGetSettingsV4Auth(BaseModel):
    """Auth item in settings."""

    auth_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    slug: str | None = None


class QGetSettingsV4Provider(BaseModel):
    """Provider item in settings."""

    provider_id: str | None = None
    name: str | None = None
    description: str | None = None
    value: str | None = None


class QGetSettingsV4Item(BaseModel):
    """Settings item returned from get endpoint."""

    settings_id: str | None = None
    created_at: datetime | None = None
    active: bool | None = None
    name: str | None = None
    description: str | None = None
    primary_color: str | None = None
    accent: str | None = None
    background: str | None = None
    surface: str | None = None
    success: str | None = None
    warning: str | None = None
    error: str | None = None
    sidebar_background: str | None = None
    sidebar_primary: str | None = None
    chart1: str | None = None
    chart2: str | None = None
    chart3: str | None = None
    chart4: str | None = None
    chart5: str | None = None
    guest_login_enabled: bool | None = None
    success_threshold: int | None = None
    warning_threshold: int | None = None
    danger_threshold: int | None = None
    auth_ids: list[str] | None = None
    auths: list[QGetSettingsV4Auth] | None = None
    provider_ids: list[str] | None = None
    providers: list[QGetSettingsV4Provider] | None = None


class GetSettingsApiRequest(BaseModel):
    """Request for getting settings by ID."""

    id: UUID


class GetSettingsApiResponse(BaseModel):
    """Response for getting settings."""

    item: QGetSettingsV4Item | None = None


class GetSettingsSqlParams(BaseModel):
    """SQL parameters for get settings."""

    settings_id_param: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.settings_id_param,)


class GetSettingsSqlRow(BaseModel):
    """SQL row for get settings."""

    items: list[QGetSettingsV4Item] | None = None


# =============================================================================
# Internal Function
# =============================================================================


async def get_settings_internal(
    conn: asyncpg.Connection,
    id: UUID,
    bypass_cache: bool = False,
) -> QGetSettingsV4Item | None:
    """Internal function to fetch settings by ID.

    Can be called directly from other routes without HTTP overhead.
    """
    tags = ["resources", "settings"]
    cache_key_val = cache_key(
        "/api/v4/resources/settings/get",
        {"id": str(id)},
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            item_data = cached.get("item")
            if item_data:
                return QGetSettingsV4Item.model_validate(item_data)
            return None

    # Execute SQL
    params = GetSettingsSqlParams(settings_id_param=id)
    result = cast(
        GetSettingsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items_list = result.items if result and result.items else []
    item: QGetSettingsV4Item | None = items_list[0] if items_list else None

    # Cache result
    await set_cached(
        cache_key_val,
        {"item": item.model_dump(mode="json") if item else None},
        ttl=60,
        tags=tags,
    )

    return item


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
    """Get settings resource by ID.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "settings"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        item = await get_settings_internal(conn, request.id, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetSettingsApiResponse(item=item)
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
