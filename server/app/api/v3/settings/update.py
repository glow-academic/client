"""Settings update endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class UpdateSettingsRequest(BaseModel):
    """Request to update settings."""

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
    profileId: str  # Required for auditing/access control
    provider_key_mapping: dict[str, str] | None = (
        None  # Provider key mapping (provider_id -> key_id)
    )
    provider_enabled: dict[str, bool] | None = (
        None  # Provider enabled mapping (provider_id -> enabled)
    )
    auth_enabled: dict[str, bool] | None = (
        None  # Auth enabled mapping (auth_id -> enabled)
    )
    auth_key_mapping: dict[str, dict[str, str]] | None = (
        None  # Auth key mapping (auth_id -> auth_item_id -> key_id) for encrypted items
    )
    auth_value_mapping: dict[str, dict[str, str]] | None = (
        None  # Auth value mapping (auth_id -> auth_item_id -> value) for non-encrypted items
    )
    default_admin_profile_id: str | None = None  # Default admin/superadmin profile ID
    default_guest_profile_id: str | None = None  # Default guest profile ID
    department_ids: list[str] | None = (
        None  # Department IDs - empty/null = global settings, non-empty = department-specific
    )


class UpdateSettingsResponse(BaseModel):
    """Response from update settings."""

    success: bool
    message: str
    settings_id: str


router = APIRouter()


@router.post("/update", response_model=UpdateSettingsResponse)
async def update_settings(
    request: UpdateSettingsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateSettingsResponse:
    """Update settings (creates new active row, deactivates old)."""
    tags = ["settings"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Prepare key mappings as JSONB
            import json

            provider_key_mapping_json = json.dumps(request.provider_key_mapping or {})
            provider_enabled_json = json.dumps(request.provider_enabled or {})
            auth_enabled_json = json.dumps(request.auth_enabled or {})
            auth_key_mapping_json = json.dumps(request.auth_key_mapping or {})
            auth_value_mapping_json = json.dumps(request.auth_value_mapping or {})
            auth_value_mapping_json = json.dumps(request.auth_value_mapping or {})

            # Update settings: deactivate current active, insert new active row
            sql_query = load_sql("sql/v3/settings/update_settings.sql")
            # Prepare department_ids array (empty array = global, non-empty = department-specific)
            department_ids_array = (
                request.department_ids if request.department_ids else None
            )

            sql_params = (
                request.name,
                request.description,
                request.primary_color,
                request.accent,
                request.background,
                request.surface,
                request.success,
                request.warning,
                request.error,
                request.sidebar_background,
                request.sidebar_primary,
                request.chart1,
                request.chart2,
                request.chart3,
                request.chart4,
                request.chart5,
                request.guest_login_enabled,
                request.success_threshold,
                request.warning_threshold,
                request.danger_threshold,
                request.profileId,
                provider_key_mapping_json,
                auth_key_mapping_json,
                request.default_admin_profile_id or None,
                request.default_guest_profile_id or None,
                provider_enabled_json,
                auth_enabled_json,
                auth_value_mapping_json,
                department_ids_array,
            )
            result = await conn.fetchrow(
                sql_query,
                request.name,
                request.description,
                request.primary_color,
                request.accent,
                request.background,
                request.surface,
                request.success,
                request.warning,
                request.error,
                request.sidebar_background,
                request.sidebar_primary,
                request.chart1,
                request.chart2,
                request.chart3,
                request.chart4,
                request.chart5,
                request.guest_login_enabled,
                request.success_threshold,
                request.warning_threshold,
                request.danger_threshold,
                request.profileId,
                provider_key_mapping_json,
                auth_key_mapping_json,
                request.default_admin_profile_id or None,
                request.default_guest_profile_id or None,
                provider_enabled_json,
                auth_enabled_json,
                auth_value_mapping_json,
                department_ids_array,
            )

            if not result:
                raise HTTPException(status_code=500, detail="Failed to update settings")

            settings_id = result["settings_id"]

            result_data = UpdateSettingsResponse(
                success=True,
                message="Settings updated successfully",
                settings_id=settings_id,
            )

            # Invalidate cache after mutation
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)

            return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_settings",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
