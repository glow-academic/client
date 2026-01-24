"""Profile context endpoint - get consolidated profile context."""

from typing import Annotated, Any, cast

import asyncpg
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetProfileContextApiRequest,
                           GetProfileContextApiResponse,
                           GetProfileContextSqlParams, GetProfileContextSqlRow,
                           QGetProfileContextV4ThemeTokens, load_sql_query)
from app.utils.sql_helper import execute_sql_typed
from app.utils.theme.color_utils import ensure_contrast, shade, tint
from app.utils.theme.oklch_to_hex import hex_to_oklch
from fastapi import APIRouter, Depends, HTTPException, Request

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/profile/get_profile_context_complete.sql"

router = APIRouter()


@router.post(
    "/context",
    response_model=GetProfileContextApiResponse,
    dependencies=[
        audit_activity("profile.context", "{{ actor.name }} viewed profile context")
    ],
)
async def get_profile_context(
    request: GetProfileContextApiRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProfileContextApiResponse:
    """
    Get consolidated profile context (profile, departments, cohorts, breadcrumbs).

    NOTE: Theme derivation stays in Python because it requires complex color math utilities
    (hex_to_oklch, ensure_contrast, shade, tint) that are not available in PostgreSQL.
    All other business logic is handled in SQL (see get_profile_context_complete.sql).
    """
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        from app.utils.logging.db_logger import get_logger

        logger = get_logger(__name__)

        # Read profile ID from request.state (set by router-level dependencies)
        # Can be None for unauthenticated requests (cookie-based auth)
        try:
            profile_id = http_request.state.profile_id
        except AttributeError:
            profile_id = None

        # Get pathname from request URL
        pathname = http_request.url.path
        logger.info(
            f"Request: pathname={pathname}, profileId={profile_id}"
        )

        # Read department-id cookie for settings resolution
        department_id_cookie = http_request.cookies.get("department-id")

        # Get all context data with emulation validation and authorization checks in single query
        sql_query = load_sql_query(SQL_PATH)

        # Convert API request to SQL params
        from uuid import UUID

        params = GetProfileContextSqlParams(
            profile_id=cast(UUID | None, profile_id),
            department_id=department_id_cookie if department_id_cookie else None,
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = cast(
            GetProfileContextSqlRow | None,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Handle case where we're fetching settings without a profile (e.g., login page)
        # Only treat as settings-only request if we have a department_id (for login page theme)
        is_settings_only_request = (
            not profile_id
            and department_id_cookie is not None
        )

        if is_settings_only_request:
            if result is None or result.settings_id is None:
                raise HTTPException(
                    status_code=404,
                    detail="Settings not available for this department. Please select a different department.",
                )
            pass
        elif not profile_id and not department_id_cookie:
            # No profile ID and no department_id
            raise HTTPException(
                status_code=404,
                detail="Profile context not found: Could not resolve profile. Please try logging in again.",
            )

        # Check that we got a valid result for profile requests
        if (
            not is_settings_only_request
            and profile_id
            and (not result or not result.is_authorized)
        ):
            raise HTTPException(
                status_code=404,
                detail=f"Profile context not found: {profile_id}",
            )

        # Note: available_sections, redirect_path, department_ids, cohort_ids, simulation_ids
        # are now computed in SQL and returned in result

        # Derive theme tokens from primitives (Python-only due to color math utilities)
        def normalize_color_to_oklch(color: str) -> str:
            """Normalize color input to oklch format."""
            color_trimmed = color.strip()
            if color_trimmed.startswith("oklch("):
                return color_trimmed
            hex_clean = color_trimmed.lstrip("#")
            if len(hex_clean) != 6 or not all(
                c in "0123456789ABCDEFabcdef" for c in hex_clean
            ):
                raise ValueError(
                    f"Invalid color format: {color}. Expected hex (e.g., '#ffffff') or oklch (e.g., 'oklch(1 0 0)')"
                )
            return hex_to_oklch(f"#{hex_clean}")

        def derive_theme_tokens(
            primitives: dict[str, str],
        ) -> QGetProfileContextV4ThemeTokens:
            """Derive full ThemeTokens from user-editable ThemePrimitives."""
            # Normalize all color inputs to oklch format
            background = normalize_color_to_oklch(primitives.get("background", ""))
            surface = normalize_color_to_oklch(primitives.get("surface", ""))
            primary = normalize_color_to_oklch(primitives.get("primary", ""))
            accent = normalize_color_to_oklch(primitives.get("accent", ""))
            sidebar_bg = normalize_color_to_oklch(
                primitives.get("sidebar_background", "")
            )
            sidebar_primary = normalize_color_to_oklch(
                primitives.get("sidebar_primary", "")
            )
            success = normalize_color_to_oklch(primitives.get("success", ""))
            warning = normalize_color_to_oklch(primitives.get("warning", ""))
            error = normalize_color_to_oklch(primitives.get("error", ""))

            # Foregrounds based on contrast
            foreground = ensure_contrast(background, "oklch(0.145 0 0)")
            primary_fg = ensure_contrast(primary, "oklch(0.985 0 0)")
            accent_fg = ensure_contrast(accent, "oklch(0.205 0 0)")
            surface_fg = ensure_contrast(surface, foreground)

            # Status foregrounds
            success_fg = ensure_contrast(success, "oklch(0.985 0 0)")
            warning_fg = ensure_contrast(warning, "oklch(0.145 0 0)")
            error_fg = ensure_contrast(error, "oklch(0.985 0 0)")

            # Info derived from primary
            info_color = tint(primary, 0.05)
            info_fg = ensure_contrast(info_color, foreground)

            # Derived colors
            muted_color = shade(background, 0.03)
            muted_fg = shade(foreground, 0.2)
            border_color = shade(background, 0.078)
            input_color = shade(background, 0.078)
            ring_color = shade(primary, 0.05)

            # Sidebar derived colors
            sidebar_fg = ensure_contrast(sidebar_bg, surface_fg)
            sidebar_primary_fg = ensure_contrast(sidebar_primary, surface_fg)
            sidebar_accent = shade(sidebar_bg, 0.015)
            sidebar_accent_fg = ensure_contrast(sidebar_accent, surface_fg)
            sidebar_border = shade(sidebar_bg, 0.064)
            sidebar_ring = shade(sidebar_primary, 0.05)

            return QGetProfileContextV4ThemeTokens(
                background=background,
                foreground=foreground,
                card=surface,
                card_foreground=surface_fg,
                popover=surface,
                popover_foreground=surface_fg,
                primary_color=primary,
                primary_foreground=primary_fg,
                secondary=accent,
                secondary_foreground=accent_fg,
                muted=muted_color,
                muted_foreground=muted_fg,
                accent=accent,
                accent_foreground=accent_fg,
                destructive=error,
                border=border_color,
                input=input_color,
                ring=ring_color,
                success=success,
                success_foreground=success_fg,
                warning=warning,
                warning_foreground=warning_fg,
                info=info_color,
                info_foreground=info_fg,
                chart1=normalize_color_to_oklch(primitives.get("chart1", "")),
                chart2=normalize_color_to_oklch(primitives.get("chart2", "")),
                chart3=normalize_color_to_oklch(primitives.get("chart3", "")),
                chart4=normalize_color_to_oklch(primitives.get("chart4", "")),
                chart5=normalize_color_to_oklch(primitives.get("chart5", "")),
                sidebar=sidebar_bg,
                sidebar_foreground=sidebar_fg,
                sidebar_primary=sidebar_primary,
                sidebar_primary_foreground=sidebar_primary_fg,
                sidebar_accent=sidebar_accent,
                sidebar_accent_foreground=sidebar_accent_fg,
                sidebar_border=sidebar_border,
                sidebar_ring=sidebar_ring,
            )

        # Parse settings and derive theme tokens
        if not result.settings_id:
            raise HTTPException(
                status_code=500, detail="Settings not found in profile context"
            )

        # Access result fields directly instead of manual dict construction
        theme_primitives = {
            "primary": result.settings_primary_color
            if result.settings_primary_color
            else "",
            "accent": result.settings_accent if result.settings_accent else "",
            "background": result.settings_background
            if result.settings_background
            else "",
            "surface": result.settings_surface if result.settings_surface else "",
            "success": result.settings_success if result.settings_success else "",
            "warning": result.settings_warning if result.settings_warning else "",
            "error": result.settings_error if result.settings_error else "",
            "sidebar_background": result.settings_sidebar_background
            if result.settings_sidebar_background
            else "",
            "sidebar_primary": result.settings_sidebar_primary
            if result.settings_sidebar_primary
            else "",
            "chart1": result.settings_chart1 if result.settings_chart1 else "",
            "chart2": result.settings_chart2 if result.settings_chart2 else "",
            "chart3": result.settings_chart3 if result.settings_chart3 else "",
            "chart4": result.settings_chart4 if result.settings_chart4 else "",
            "chart5": result.settings_chart5 if result.settings_chart5 else "",
        }

        theme_tokens = derive_theme_tokens(theme_primitives)

        # Set audit context
        actor_profile_id = profile_id
        actor_name = result.actor_name

        if actor_name and actor_profile_id:
            audit_set(http_request, actor={"name": actor_name, "id": actor_profile_id})

        # Construct response properly with computed theme tokens (no manual dict manipulation)
        api_response = GetProfileContextApiResponse(
            **result.model_dump(exclude={"settings_tokens"}),
            settings_tokens=theme_tokens,
        )

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_profile_context",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
