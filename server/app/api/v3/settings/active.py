"""Settings active endpoint."""

from typing import Annotated, Any, Literal

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql
from app.utils.theme.color_utils import ensure_contrast, shade, tint
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


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
    color: str
    organization_name: str
    mode: Literal["light", "dark", "system"] = "light"
    tokens: ThemeTokens


router = APIRouter()


def derive_theme_tokens(primitives: ThemePrimitives) -> ThemeTokens:
    """
    Derive full ThemeTokens from user-editable ThemePrimitives.
    This function computes all internal design tokens from the small set of primitives.
    """
    background = primitives.background
    surface = primitives.surface

    primary = primitives.primary
    accent = primitives.accent
    sidebar_bg = primitives.sidebarBackground
    sidebar_primary = primitives.sidebarPrimary

    # Foregrounds based on contrast
    foreground = ensure_contrast(background, "oklch(0.145 0 0)")
    primary_fg = ensure_contrast(primary, "oklch(0.985 0 0)")
    accent_fg = ensure_contrast(accent, "oklch(0.205 0 0)")
    surface_fg = ensure_contrast(surface, foreground)

    # Status foregrounds
    success_fg = ensure_contrast(primitives.success, "oklch(0.985 0 0)")
    warning_fg = ensure_contrast(primitives.warning, "oklch(0.145 0 0)")
    error_fg = ensure_contrast(primitives.error, "oklch(0.985 0 0)")

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
        destructive=primitives.error,
        border=border_color,
        input=input_color,
        ring=ring_color,
        success=primitives.success,
        successForeground=success_fg,
        warning=primitives.warning,
        warningForeground=warning_fg,
        info=info_color,
        infoForeground=info_fg,
        chart1=primitives.chart1,
        chart2=primitives.chart2,
        chart3=primitives.chart3,
        chart4=primitives.chart4,
        chart5=primitives.chart5,
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
        sql_params = ()  # No parameters for this query
        settings = await conn.fetchrow(sql_query)

        if not settings:
            raise HTTPException(
                status_code=404, detail="No active settings found"
            )

        # POC: Hardcoded theme primitives matching original globals.css defaults
        # In production, these would come from the database
        hardcoded_primitives = ThemePrimitives(
            primary="oklch(0.205 0 0)",  # Dark gray/black (original primary)
            accent="oklch(0.97 0 0)",  # Very light gray (original accent/secondary)
            background="oklch(1 0 0)",  # White (original background)
            surface="oklch(1 0 0)",  # White (original card/popover)
            success="oklch(0.6 0.2 150)",  # Green (from globals.css)
            warning="oklch(0.7 0.2 70)",  # Yellow/orange (from globals.css)
            error="oklch(0.577 0.245 27.325)",  # Red (original destructive)
            sidebarBackground="oklch(0.985 0 0)",  # Very light gray (original sidebar)
            sidebarPrimary="oklch(0.205 0 0)",  # Dark gray (original sidebar-primary)
            chart1="oklch(0.646 0.222 41.116)",  # Original chart-1
            chart2="oklch(0.6 0.118 184.704)",  # Original chart-2
            chart3="oklch(0.398 0.07 227.392)",  # Original chart-3
            chart4="oklch(0.828 0.189 84.429)",  # Original chart-4
            chart5="oklch(0.769 0.188 70.08)",  # Original chart-5
        )

        # Derive full theme tokens from primitives
        theme_tokens = derive_theme_tokens(hardcoded_primitives)

        response_data = SettingsActiveResponse(
            settings_id=settings["settings_id"],
            created_at=settings["created_at"].isoformat()
            if settings["created_at"]
            else "",
            active=settings["active"],
            color=settings["color"],
            organization_name=settings["organization_name"],
            mode="light",
            tokens=theme_tokens,
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

