"""Settings detail endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from app.infra.error.handle_route_error import handle_route_error
from utils.sql_helper import load_sql


# Inline request/response schemas
class SettingsDetailRequest(BaseModel):
    """Request to get settings details."""

    settingsId: str
    # profileId removed - comes from X-Profile-Id header


class SettingsDetailResponse(BaseModel):
    """Detailed settings response."""

    settings_id: str
    created_at: str
    active: bool
    name: str
    description: str
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
    provider_mapping: dict[
        str, dict[str, str]
    ]  # Provider mapping with name, description, value
    provider_key_mapping: dict[str, str]  # Provider key mapping (provider_id -> key_id)
    auth_key_mapping: dict[
        str, dict[str, str]
    ]  # Auth key mapping (auth_id -> auth_item_id -> key_id)
    auth_value_mapping: dict[
        str, dict[str, str]
    ]  # Auth value mapping (auth_id -> auth_item_id -> value) for non-encrypted items
    auth_items_mapping: dict[
        str, list[dict[str, Any]]
    ]  # Auth items mapping (auth_id -> list of auth_items)
    default_admin_profile_id: str | None  # Default admin/superadmin profile ID
    default_admin_name: str | None  # Default admin/superadmin profile name
    default_guest_profile_id: str | None  # Default guest profile ID
    default_guest_name: str | None  # Default guest profile name
    all_provider_ids: list[str]  # All available provider IDs
    all_provider_mapping: dict[
        str, dict[str, str | bool]
    ]  # All providers mapping (provider_id -> {name, description, value, active})
    all_auth_ids: list[str]  # All available auth IDs
    all_auth_mapping: dict[
        str, dict[str, str | bool]
    ]  # All auths mapping (auth_id -> {name, description, slug, active})
    department_ids: list[str] | None = None  # Linked department IDs


router = APIRouter()


@router.post(
    "/detail",
    response_model=SettingsDetailResponse,
    dependencies=[
        audit_activity(
            "settings.detail", "{{ actor.name }} viewed settings '{{ settings.name }}'"
        )
    ],
)
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
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        sql_query = load_sql("app/sql/v3/settings/get_settings_detail.sql")
        sql_params = (request.settingsId, profile_id)
        settings = await conn.fetchrow(sql_query, request.settingsId, profile_id)

        # Get actor name from result
        actor_name = settings.get("actor_name") if settings else None

        # Set audit context
        if actor_name and settings:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                settings={"name": settings.get("name", ""), "id": request.settingsId},
            )

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

        # Parse provider key mapping
        provider_key_mapping: dict[str, str] = {}
        provider_key_mapping_data = settings.get("provider_key_mapping")
        if isinstance(provider_key_mapping_data, str):
            provider_key_mapping_data = json.loads(provider_key_mapping_data)
        if provider_key_mapping_data and isinstance(provider_key_mapping_data, dict):
            provider_key_mapping = {
                str(k): str(v) for k, v in provider_key_mapping_data.items()
            }

        # Parse auth key mapping
        auth_key_mapping: dict[str, dict[str, str]] = {}
        auth_key_mapping_data = settings.get("auth_key_mapping")
        if isinstance(auth_key_mapping_data, str):
            auth_key_mapping_data = json.loads(auth_key_mapping_data)
        if auth_key_mapping_data and isinstance(auth_key_mapping_data, dict):
            auth_key_mapping = {
                str(auth_id): {
                    str(item_id): str(key_id)
                    for item_id, key_id in item_mapping.items()
                }
                if isinstance(item_mapping, dict)
                else {}
                for auth_id, item_mapping in auth_key_mapping_data.items()
            }

        # Parse auth value mapping (for non-encrypted items)
        auth_value_mapping: dict[str, dict[str, str]] = {}
        auth_value_mapping_data = settings.get("auth_value_mapping")
        if isinstance(auth_value_mapping_data, str):
            auth_value_mapping_data = json.loads(auth_value_mapping_data)
        if auth_value_mapping_data and isinstance(auth_value_mapping_data, dict):
            auth_value_mapping = {
                str(auth_id): {
                    str(item_id): str(value) for item_id, value in item_mapping.items()
                }
                if isinstance(item_mapping, dict)
                else {}
                for auth_id, item_mapping in auth_value_mapping_data.items()
            }

        # Parse auth items mapping
        auth_items_mapping: dict[str, list[dict[str, Any]]] = {}
        auth_items_mapping_data = settings.get("auth_items_mapping")
        if isinstance(auth_items_mapping_data, str):
            auth_items_mapping_data = json.loads(auth_items_mapping_data)
        if auth_items_mapping_data and isinstance(auth_items_mapping_data, dict):
            auth_items_mapping = {
                str(auth_id): items if isinstance(items, list) else []
                for auth_id, items in auth_items_mapping_data.items()
            }

        # Parse all provider IDs and mapping
        all_provider_ids: list[str] = []
        all_provider_ids_raw = settings.get("all_provider_ids")
        if all_provider_ids_raw and isinstance(all_provider_ids_raw, (list, tuple)):
            all_provider_ids = [str(pid) for pid in all_provider_ids_raw if pid]

        all_provider_mapping: dict[str, dict[str, str | bool]] = {}
        all_provider_mapping_data = settings.get("all_provider_mapping")
        if isinstance(all_provider_mapping_data, str):
            all_provider_mapping_data = json.loads(all_provider_mapping_data)
        if all_provider_mapping_data and isinstance(all_provider_mapping_data, dict):
            all_provider_mapping = {
                str(pid): {str(k): v for k, v in pmap.items()}
                if isinstance(pmap, dict)
                else {}
                for pid, pmap in all_provider_mapping_data.items()
            }

        # Parse all auth IDs and mapping
        all_auth_ids: list[str] = []
        all_auth_ids_raw = settings.get("all_auth_ids")
        if all_auth_ids_raw and isinstance(all_auth_ids_raw, (list, tuple)):
            all_auth_ids = [str(aid) for aid in all_auth_ids_raw if aid]

        all_auth_mapping: dict[str, dict[str, str | bool]] = {}
        all_auth_mapping_data = settings.get("all_auth_mapping")
        if isinstance(all_auth_mapping_data, str):
            all_auth_mapping_data = json.loads(all_auth_mapping_data)
        if all_auth_mapping_data and isinstance(all_auth_mapping_data, dict):
            all_auth_mapping = {
                str(aid): {str(k): v for k, v in amap.items()}
                if isinstance(amap, dict)
                else {}
                for aid, amap in all_auth_mapping_data.items()
            }

        # Parse department_ids from array
        department_ids: list[str] | None = None
        department_ids_raw = settings.get("department_ids")
        if department_ids_raw and isinstance(department_ids_raw, (list, tuple)):
            department_ids = [str(did) for did in department_ids_raw if did]

        response_data = SettingsDetailResponse(
            settings_id=settings["settings_id"],
            created_at=settings["created_at"].isoformat()
            if settings["created_at"]
            else "",
            active=settings["active"],
            name=settings["name"],
            description=settings["description"],
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
            provider_key_mapping=provider_key_mapping,
            auth_key_mapping=auth_key_mapping,
            auth_value_mapping=auth_value_mapping,
            auth_items_mapping=auth_items_mapping,
            default_admin_profile_id=settings.get("default_admin_profile_id"),
            default_admin_name=settings.get("default_admin_name"),
            default_guest_profile_id=settings.get("default_guest_profile_id"),
            default_guest_name=settings.get("default_guest_name"),
            all_provider_ids=all_provider_ids,
            all_provider_mapping=all_provider_mapping,
            all_auth_ids=all_auth_ids,
            all_auth_mapping=all_auth_mapping,
            department_ids=department_ids,
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
