"""Resolve settings theme — composes canonical black boxes.

Given a settings_id (artifact), fetches:
  1. Setting artifact with colors, thresholds, flags junctions
  2. Colors, thresholds, flags resources in parallel
  3. Maps by type in Python → theme primitives + thresholds

No inline SQL.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.routes.v5.tools.artifacts.setting.get import (
    get_settings as get_setting_artifacts,
)
from app.routes.v5.tools.resources.colors.get import get_colors
from app.routes.v5.tools.resources.flags.get import get_flags
from app.routes.v5.tools.resources.thresholds.get import get_thresholds


@dataclass(frozen=True)
class SettingsThemeResult:
    """Resolved theme data from a setting artifact."""

    is_active: bool
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
    success_threshold: int | None = None
    warning_threshold: int | None = None
    danger_threshold: int | None = None


async def resolve_settings_theme(
    conn: asyncpg.Connection,
    redis: Redis,
    settings_id: UUID,
    bypass_cache: bool = False,
) -> SettingsThemeResult | None:
    """Resolve theme primitives + thresholds from a setting artifact.

    Composes canonical black boxes — no inline SQL.
    """
    # Step 1: Get setting artifact with junction IDs
    artifacts = await get_setting_artifacts(
        conn,
        [settings_id],
        colors=True,
        thresholds=True,
        flags=True,
    )
    if not artifacts:
        return None

    artifact = artifacts[0]
    color_ids = artifact.color_ids or []
    threshold_ids = artifact.threshold_ids or []
    flag_ids = artifact.flag_ids or []

    # Step 2: Fetch resources in parallel
    colors_res, thresholds_res, flags_res = await asyncio.gather(
        get_colors(conn, color_ids, redis, bypass_cache) if color_ids else _empty(),
        get_thresholds(conn, threshold_ids, redis, bypass_cache)
        if threshold_ids
        else _empty(),
        get_flags(conn, flag_ids, redis, bypass_cache) if flag_ids else _empty(),
    )

    # Step 3: Check active flag
    is_active = any(
        f.name == "setting_active" and f.value is True for f in flags_res
    )
    if not is_active:
        return SettingsThemeResult(is_active=False)

    # Step 4: Map colors by type
    color_map: dict[str, str] = {}
    for c in colors_res:
        color_map[c.type] = c.hex_code

    # Step 5: Map thresholds by type
    threshold_map: dict[str, int] = {}
    for t in thresholds_res:
        threshold_map[t.type] = t.value

    return SettingsThemeResult(
        is_active=True,
        primary_color=color_map.get("primary"),
        accent=color_map.get("accent"),
        background=color_map.get("background"),
        surface=color_map.get("surface"),
        success=color_map.get("success"),
        warning=color_map.get("warning"),
        error=color_map.get("error"),
        sidebar_background=color_map.get("sidebar_background"),
        sidebar_primary=color_map.get("sidebar_primary"),
        chart1=color_map.get("chart1"),
        chart2=color_map.get("chart2"),
        chart3=color_map.get("chart3"),
        chart4=color_map.get("chart4"),
        chart5=color_map.get("chart5"),
        success_threshold=threshold_map.get("success"),
        warning_threshold=threshold_map.get("warning"),
        danger_threshold=threshold_map.get("danger"),
    )


async def _empty() -> list:
    return []
