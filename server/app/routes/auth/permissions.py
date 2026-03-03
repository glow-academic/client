"""Pure derivation/conversion helpers for profile context."""

from __future__ import annotations

from typing import Any

from app.routes.v5.api.resources.cohorts.types import QGetCohortsV4Item
from app.routes.v5.api.resources.departments.get import QGetDepartmentsV4Item
from app.sql.types import (
    QGetProfileContextAccessV4ArtifactAgent,
    QGetProfileContextV4Cohort,
    QGetProfileContextV4Department,
    QGetProfileContextV4RoleResource,
    QGetProfileContextV4ThemeTokens,
)
from app.utils.theme.color_utils import ensure_contrast, shade, tint
from app.utils.theme.oklch_to_hex import hex_to_oklch


def normalize_color_to_oklch(color: str) -> str:
    """Normalize color input to oklch format."""
    color_trimmed = color.strip()
    if color_trimmed.startswith("oklch("):
        return color_trimmed
    hex_clean = color_trimmed.lstrip("#")
    if len(hex_clean) != 6 or not all(c in "0123456789ABCDEFabcdef" for c in hex_clean):
        raise ValueError(
            f"Invalid color format: {color}. Expected hex (e.g., '#ffffff') or oklch (e.g., 'oklch(1 0 0)')"
        )
    return hex_to_oklch(f"#{hex_clean}")


def derive_theme_tokens(primitives: dict[str, str]) -> QGetProfileContextV4ThemeTokens:
    """Derive full ThemeTokens from user-editable ThemePrimitives."""
    background = normalize_color_to_oklch(primitives.get("background", ""))
    surface = normalize_color_to_oklch(primitives.get("surface", ""))
    primary = normalize_color_to_oklch(primitives.get("primary", ""))
    accent = normalize_color_to_oklch(primitives.get("accent", ""))
    sidebar_bg = normalize_color_to_oklch(primitives.get("sidebar_background", ""))
    sidebar_primary = normalize_color_to_oklch(primitives.get("sidebar_primary", ""))
    success = normalize_color_to_oklch(primitives.get("success", ""))
    warning = normalize_color_to_oklch(primitives.get("warning", ""))
    error = normalize_color_to_oklch(primitives.get("error", ""))

    foreground = ensure_contrast(background, "oklch(0.145 0 0)")
    primary_fg = ensure_contrast(primary, "oklch(0.985 0 0)")
    accent_fg = ensure_contrast(accent, "oklch(0.205 0 0)")
    surface_fg = ensure_contrast(surface, foreground)

    success_fg = ensure_contrast(success, "oklch(0.985 0 0)")
    warning_fg = ensure_contrast(warning, "oklch(0.145 0 0)")
    error_fg = ensure_contrast(error, "oklch(0.985 0 0)")

    info_color = tint(primary, 0.05)
    info_fg = ensure_contrast(info_color, foreground)

    muted_color = shade(background, 0.03)
    muted_fg = shade(foreground, 0.2)
    border_color = shade(background, 0.078)
    input_color = shade(background, 0.078)
    ring_color = shade(primary, 0.05)

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


def convert_department(item: QGetDepartmentsV4Item) -> QGetProfileContextV4Department:
    return QGetProfileContextV4Department(
        department_id=item.department_id,
        title=item.name,
        description=item.description,
        active=True,
        is_primary=False,
    )


def convert_cohort(item: QGetCohortsV4Item) -> QGetProfileContextV4Cohort:
    return QGetProfileContextV4Cohort(
        cohort_id=item.cohort_id,
        title=item.title,
        description=item.description,
        active=item.active,
        department_ids=item.department_ids,
    )


def convert_role(role: Any) -> QGetProfileContextV4RoleResource:
    return QGetProfileContextV4RoleResource(
        role=role.role,
        name=role.name,
        description=role.description,
        icon_value=role.icon_value,
        color_hex=role.color_hex,
    )


OPERATIONAL_ARTIFACTS = frozenset(
    {
        "agent",
        "auth",
        "chat",
        "cohort",
        "department",
        "document",
        "eval",
        "field",
        "invocation",
        "model",
        "parameter",
        "persona",
        "profile",
        "provider",
        "rubric",
        "scenario",
        "setting",
        "simulation",
        "tool",
    }
)


def build_artifact_generation_maps(
    items: list[QGetProfileContextAccessV4ArtifactAgent] | None,
) -> dict[str, bool]:
    has_generate: dict[str, bool] = {}
    for item in items or []:
        if item.artifact and item.has_generation:
            if item.artifact in OPERATIONAL_ARTIFACTS:
                has_generate[item.artifact] = True
    return has_generate
