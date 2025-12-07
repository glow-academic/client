"""Settings detail endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class SettingsDetailRequest(BaseModel):
    """Request to get settings details."""

    settingsId: str
    profileId: str


class SettingsDetailResponse(BaseModel):
    """Detailed settings response."""

    settings_id: str
    created_at: str
    active: bool
    primary_color: str
    accent: str
    background: str
    surface: str
    success: str
    warning: str
    error: str
    sidebar_background: str
    sidebar_primary: str
    chart1: str
    chart2: str
    chart3: str
    chart4: str
    chart5: str
    guest_login_enabled: bool
    success_threshold: int
    warning_threshold: int
    danger_threshold: int
    auth_ids: list[str]  # Linked auth IDs
    auth_mapping: dict[str, dict[str, str]]  # Auth mapping with name, description, slug
    provider_ids: list[str]  # Linked provider IDs
    provider_mapping: dict[str, dict[str, str]]  # Provider mapping with name, description, value


router = APIRouter()


@router.post("/detail", response_model=SettingsDetailResponse)
async def get_settings_detail(
    request: SettingsDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SettingsDetailResponse:
    """Get detailed settings information."""
    tags = ["settings"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return SettingsDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/settings/get_settings_detail.sql")
        sql_params = (request.settingsId,)
        settings = await conn.fetchrow(sql_query, request.settingsId)

        if not settings:
            raise HTTPException(
                status_code=404, detail=f"Settings not found: {request.settingsId}"
            )

        # Parse auth_ids and provider_ids from arrays
        import json
        auth_ids: list[str] = []
        auth_ids_raw = settings.get("auth_ids")
        if auth_ids_raw and isinstance(auth_ids_raw, (list, tuple)):
            auth_ids = [str(aid) for aid in auth_ids_raw if aid]

        provider_ids: list[str] = []
        provider_ids_raw = settings.get("provider_ids")
        if provider_ids_raw and isinstance(provider_ids_raw, (list, tuple)):
            provider_ids = [str(pid) for pid in provider_ids_raw if pid]

        # Parse mappings from JSONB
        auth_mapping: dict[str, dict[str, str]] = {}
        auth_mapping_data = settings.get("auth_mapping")
        if isinstance(auth_mapping_data, str):
            auth_mapping_data = json.loads(auth_mapping_data)
        if auth_mapping_data and isinstance(auth_mapping_data, dict):
            auth_mapping = auth_mapping_data

        provider_mapping: dict[str, dict[str, str]] = {}
        provider_mapping_data = settings.get("provider_mapping")
        if isinstance(provider_mapping_data, str):
            provider_mapping_data = json.loads(provider_mapping_data)
        if provider_mapping_data and isinstance(provider_mapping_data, dict):
            provider_mapping = provider_mapping_data

        response_data = SettingsDetailResponse(
            settings_id=settings["settings_id"],
            created_at=settings["created_at"].isoformat()
            if settings["created_at"]
            else "",
            active=settings["active"],
            primary_color=settings["primary_color"],
            accent=settings["accent"],
            background=settings["background"],
            surface=settings["surface"],
            success=settings["success"],
            warning=settings["warning"],
            error=settings["error"],
            sidebar_background=settings["sidebar_background"],
            sidebar_primary=settings["sidebar_primary"],
            chart1=settings["chart1"],
            chart2=settings["chart2"],
            chart3=settings["chart3"],
            chart4=settings["chart4"],
            chart5=settings["chart5"],
            guest_login_enabled=settings["guest_login_enabled"],
            success_threshold=settings["success_threshold"],
            warning_threshold=settings["warning_threshold"],
            danger_threshold=settings["danger_threshold"],
            auth_ids=auth_ids,
            auth_mapping=auth_mapping,
            provider_ids=provider_ids,
            provider_mapping=provider_mapping,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_settings_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

