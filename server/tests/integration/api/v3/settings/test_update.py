"""Route tests for POST /api/v3/settings/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_update_settings(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating settings (creates new active row, deactivates old)."""
    profile_id = await get_superadmin_alias(db)

    # Create an active settings row first
    old_settings_id = await db.fetchval(
        "INSERT INTO settings (active, primary_color) "
        "VALUES (true, '#000000') RETURNING id"
    )

    response = await client.post(
        "/api/v3/settings/update",
        json={
            "primary_color": "#3B82F6",
            "accent": "#f5f5f5",
            "background": "#ffffff",
            "surface": "#ffffff",
            "success": "#009e34",
            "warning": "#ea8100",
            "error": "#e7000b",
            "sidebar_background": "#fafafa",
            "sidebar_primary": "#171717",
            "chart1": "#f54900",
            "chart2": "#009689",
            "chart3": "#104e64",
            "chart4": "#ffb900",
            "chart5": "#fe9a00",
            "guest_login_enabled": True,
            "success_threshold": 85,
            "warning_threshold": 80,
            "danger_threshold": 70,
            "profileId": profile_id,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "settings_id" in data
    assert "message" in data
    assert data["message"] == "Settings updated successfully"

    new_settings_id = data["settings_id"]
    assert new_settings_id != str(old_settings_id)

    # Verify old settings is deactivated
    old_settings = await db.fetchrow(
        "SELECT active FROM settings WHERE id = $1", old_settings_id
    )
    assert old_settings is not None
    assert old_settings["active"] is False

    # Verify new settings is active
    new_settings = await db.fetchrow(
        "SELECT active, primary_color FROM settings WHERE id = $1",
        new_settings_id,
    )
    assert new_settings is not None
    assert new_settings["active"] is True
    assert new_settings["primary_color"] == "#3B82F6"

    # Verify only one active settings exists
    active_count = await db.fetchval(
        "SELECT COUNT(*) FROM settings WHERE active = true"
    )
    assert active_count == 1


async def test_update_settings_no_existing_active(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating settings when no active settings exists."""
    profile_id = await get_superadmin_alias(db)

    # Delete all active settings
    await db.execute("UPDATE settings SET active = false WHERE active = true")

    response = await client.post(
        "/api/v3/settings/update",
        json={
            "primary_color": "#FF0000",
            "accent": "#f5f5f5",
            "background": "#ffffff",
            "surface": "#ffffff",
            "success": "#009e34",
            "warning": "#ea8100",
            "error": "#e7000b",
            "sidebar_background": "#fafafa",
            "sidebar_primary": "#171717",
            "chart1": "#f54900",
            "chart2": "#009689",
            "chart3": "#104e64",
            "chart4": "#ffb900",
            "chart5": "#fe9a00",
            "guest_login_enabled": True,
            "success_threshold": 85,
            "warning_threshold": 80,
            "danger_threshold": 70,
            "profileId": profile_id,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "settings_id" in data

    # Verify new settings is active
    new_settings = await db.fetchrow(
        "SELECT active, primary_color FROM settings WHERE id = $1",
        data["settings_id"],
    )
    assert new_settings is not None
    assert new_settings["active"] is True
    assert new_settings["primary_color"] == "#FF0000"
