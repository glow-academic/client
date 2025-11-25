"""Route tests for POST /api/v3/settings/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_list_settings(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting settings list."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/settings/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert "settings" in data
    assert isinstance(data["settings"], list)

    # If settings exist, verify structure
    if data["settings"]:
        setting = data["settings"][0]
        assert "settings_id" in setting
        assert "created_at" in setting
        assert "active" in setting
        assert "color" in setting
        assert "organization_name" in setting
        assert isinstance(setting["active"], bool)
        assert isinstance(setting["color"], str)
        assert isinstance(setting["organization_name"], str)


async def test_list_settings_ordered_by_created_at(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that settings are ordered by created_at DESC."""
    profile_id = await get_superadmin_alias(db)

    # Create multiple settings
    await db.execute(
        "INSERT INTO settings (active, color, organization_name) VALUES (false, '#000000', 'Old Org')"
    )
    await db.execute(
        "INSERT INTO settings (active, color, organization_name) VALUES (true, '#FFFFFF', 'New Org')"
    )

    response = await client.post(
        "/api/v3/settings/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    if len(data["settings"]) >= 2:
        # Check that newer settings come first
        first_created = data["settings"][0]["created_at"]
        second_created = data["settings"][1]["created_at"]
        assert first_created >= second_created

