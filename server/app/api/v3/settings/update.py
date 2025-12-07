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
    provider_key_mapping: dict[str, str] | None = None  # Provider key mapping (provider_id -> key_id)
    auth_key_mapping: dict[str, dict[str, str]] | None = None  # Auth key mapping (auth_id -> auth_item_id -> key_id)


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
            provider_key_mapping_json = json.dumps(
                request.provider_key_mapping or {}
            )
            auth_key_mapping_json = json.dumps(request.auth_key_mapping or {})

            # Update settings: deactivate current active, insert new active row
            sql_query = load_sql("sql/v3/settings/update_settings.sql")
            sql_params = (
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
            )
            result = await conn.fetchrow(
                sql_query,
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
            )

            if not result:
                raise HTTPException(
                    status_code=500, detail="Failed to update settings"
                )

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

