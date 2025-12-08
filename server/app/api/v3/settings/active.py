"""Settings active endpoint."""

from typing import Annotated, Any, Literal

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql
from app.utils.theme.color_utils import ensure_contrast, shade, tint
from app.utils.theme.oklch_to_hex import hex_to_oklch


# Inline request/response schemas
class SettingsActiveRequest(BaseModel):
    """Request to get active settings."""

    profileId: str


class ThemePrimitives(BaseModel):
    """
    High-level theme primitives that users can configure.
    These are stored in the database and edited in the admin UI.
    Following BCNF principles: no nulls (using defaults), minimal redundancy.
    """

    # Core brand
    primary: str  # Main brand/action color
    accent: str  # Secondary brand color (derived if not provided)

    # Layout
    background: str  # Page background
    surface: str  # Cards/panels (derived from background if not provided)

    # Status colors
    success: str
    warning: str
    error: str

    # Sidebar (derived from background/primary if not provided)
    sidebarBackground: str
    sidebarPrimary: str

    # Data/charts colors (normalized to 5 separate attributes)
    chart1: str
    chart2: str
    chart3: str
    chart4: str
    chart5: str


class ThemeTokens(BaseModel):
    """
    Full internal design tokens derived from ThemePrimitives.
    This is what components consume via CSS variables.
    Users do not edit this directly.
    """

    background: str
    foreground: str
    card: str
    cardForeground: str
    popover: str
    popoverForeground: str
    primary: str
    primaryForeground: str
    secondary: str
    secondaryForeground: str
    muted: str
    mutedForeground: str
    accent: str
    accentForeground: str
    destructive: str
    border: str
    input: str
    ring: str
    # Status tokens
    success: str
    successForeground: str
    warning: str
    warningForeground: str
    info: str
    infoForeground: str
    # Chart tokens
    chart1: str
    chart2: str
    chart3: str
    chart4: str
    chart5: str
    # Sidebar tokens
    sidebar: str
    sidebarForeground: str
    sidebarPrimary: str
    sidebarPrimaryForeground: str
    sidebarAccent: str
    sidebarAccentForeground: str
    sidebarBorder: str
    sidebarRing: str


class SettingsActiveResponse(BaseModel):
    """Active settings response."""

    settings_id: str
    created_at: str
    active: bool
    mode: Literal["light", "dark", "system"] = "light"
    tokens: ThemeTokens
    guest_login_enabled: bool
    success_threshold: int
    warning_threshold: int
    danger_threshold: int


router = APIRouter()


def normalize_color_to_oklch(color: str) -> str:
    """
    Normalize color input to oklch format.
    Accepts hex (e.g., '#ffffff' or 'ffffff') or oklch (e.g., 'oklch(1 0 0)').
    Always returns oklch format.
    """
    color_trimmed = color.strip()

    # Check if it's already oklch format
    if color_trimmed.startswith("oklch("):
        return color_trimmed

    # Otherwise, assume it's hex and convert
    # Remove # if present
    hex_clean = color_trimmed.lstrip("#")

    # Validate hex format (must be 6 characters)
    if len(hex_clean) != 6 or not all(c in "0123456789ABCDEFabcdef" for c in hex_clean):
        raise ValueError(
            f"Invalid color format: {color}. Expected hex (e.g., '#ffffff') or oklch (e.g., 'oklch(1 0 0)')"
        )

    return hex_to_oklch(f"#{hex_clean}")


def derive_theme_tokens(primitives: ThemePrimitives) -> ThemeTokens:
    """
    Derive full ThemeTokens from user-editable ThemePrimitives.
    This function computes all internal design tokens from the small set of primitives.

    Accepts hex or oklch format in primitives, normalizes all to oklch.
    """
    # Normalize all color inputs to oklch format (handles hex from color picker)
    background = normalize_color_to_oklch(primitives.background)
    surface = normalize_color_to_oklch(primitives.surface)

    primary = normalize_color_to_oklch(primitives.primary)
    accent = normalize_color_to_oklch(primitives.accent)
    sidebar_bg = normalize_color_to_oklch(primitives.sidebarBackground)
    sidebar_primary = normalize_color_to_oklch(primitives.sidebarPrimary)

    success = normalize_color_to_oklch(primitives.success)
    warning = normalize_color_to_oklch(primitives.warning)
    error = normalize_color_to_oklch(primitives.error)

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
    # For light backgrounds, these need to be darker (shade), not lighter (tint)
    # Original: muted=oklch(0.97), border=oklch(0.922), input=oklch(0.922)
    muted_color = shade(background, 0.03)  # Darken slightly from background
    muted_fg = shade(foreground, 0.2)
    border_color = shade(background, 0.078)  # Darken to match original oklch(0.922)
    input_color = shade(background, 0.078)  # Same as border
    ring_color = shade(primary, 0.05)

    # Sidebar derived colors
    sidebar_fg = ensure_contrast(sidebar_bg, surface_fg)
    sidebar_primary_fg = ensure_contrast(sidebar_primary, surface_fg)
    # Sidebar accent should be darker than sidebar_bg (original: oklch(0.97) from oklch(0.985))
    sidebar_accent = shade(sidebar_bg, 0.015)  # Slightly darker
    sidebar_accent_fg = ensure_contrast(sidebar_accent, surface_fg)
    # Sidebar border should be darker (original: oklch(0.922) from sidebar oklch(0.985))
    sidebar_border = shade(sidebar_bg, 0.064)  # Darken to match original
    sidebar_ring = shade(sidebar_primary, 0.05)

    return ThemeTokens(
        background=background,
        foreground=foreground,
        card=surface,
        cardForeground=surface_fg,
        popover=surface,
        popoverForeground=surface_fg,
        primary=primary,
        primaryForeground=primary_fg,
        secondary=accent,
        secondaryForeground=accent_fg,
        muted=muted_color,
        mutedForeground=muted_fg,
        accent=accent,
        accentForeground=accent_fg,
        destructive=error,
        border=border_color,
        input=input_color,
        ring=ring_color,
        success=success,
        successForeground=success_fg,
        warning=warning,
        warningForeground=warning_fg,
        info=info_color,
        infoForeground=info_fg,
        chart1=normalize_color_to_oklch(primitives.chart1),
        chart2=normalize_color_to_oklch(primitives.chart2),
        chart3=normalize_color_to_oklch(primitives.chart3),
        chart4=normalize_color_to_oklch(primitives.chart4),
        chart5=normalize_color_to_oklch(primitives.chart5),
        sidebar=sidebar_bg,
        sidebarForeground=sidebar_fg,
        sidebarPrimary=sidebar_primary,
        sidebarPrimaryForeground=sidebar_primary_fg,
        sidebarAccent=sidebar_accent,
        sidebarAccentForeground=sidebar_accent_fg,
        sidebarBorder=sidebar_border,
        sidebarRing=sidebar_ring,
    )


@router.post("/active", response_model=SettingsActiveResponse)
async def get_active_settings(
    request: SettingsActiveRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SettingsActiveResponse:
    """Get active settings information."""
    tags = ["settings"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return SettingsActiveResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/settings/get_active_settings.sql")
        # Pass profileId directly to SQL query
        # SQL handles "guest-profile-id" specially to return default settings
        sql_params = (request.profileId,)
        settings = await conn.fetchrow(sql_query, request.profileId)

        if not settings:
            raise HTTPException(status_code=404, detail="No active settings found")

        # Read ThemePrimitives from database
        # NOTE: ThemePrimitives accepts BOTH hex and oklch formats:
        #   - Hex: "#ffffff" or "ffffff" (from color picker)
        #   - OKLCH: "oklch(1 0 0)" (for precise color control)
        # All values are normalized to oklch internally via normalize_color_to_oklch()
        theme_primitives = ThemePrimitives(
            primary=settings["primary_color"],
            accent=settings["accent"],
            background=settings["background"],
            surface=settings["surface"],
            success=settings["success"],
            warning=settings["warning"],
            error=settings["error"],
            sidebarBackground=settings["sidebar_background"],
            sidebarPrimary=settings["sidebar_primary"],
            chart1=settings["chart1"],
            chart2=settings["chart2"],
            chart3=settings["chart3"],
            chart4=settings["chart4"],
            chart5=settings["chart5"],
        )

        # Derive full theme tokens from primitives
        theme_tokens = derive_theme_tokens(theme_primitives)

        response_data = SettingsActiveResponse(
            settings_id=settings["settings_id"],
            created_at=settings["created_at"].isoformat()
            if settings["created_at"]
            else "",
            active=settings["active"],
            mode="light",
            tokens=theme_tokens,
            guest_login_enabled=settings["guest_login_enabled"],
            success_threshold=settings["success_threshold"],
            warning_threshold=settings["warning_threshold"],
            danger_threshold=settings["danger_threshold"],
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
            operation="get_active_settings",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
