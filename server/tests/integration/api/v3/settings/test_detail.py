"""Route tests for POST /api/v3/settings/detail endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_settings_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting settings detail."""
    profile_id = await get_superadmin_alias(db)

    # Create a settings row first
    settings_id = await db.fetchval(
        "INSERT INTO settings (active, primary_color) "
        "VALUES (true, '#3B82F6') RETURNING id"
    )

    response = await client.post(
        "/api/v3/settings/detail",
        json={"settingsId": str(settings_id), "profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "settings_id" in data
    assert data["settings_id"] == str(settings_id)
    assert "created_at" in data
    assert "active" in data
    assert data["active"] is True
    assert "primary_color" in data
    assert data["primary_color"] == "#3B82F6"


async def test_get_settings_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting detail for non-existent settings."""
    profile_id = await get_superadmin_alias(db)
    fake_settings_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/settings/detail",
        json={"settingsId": fake_settings_id, "profileId": profile_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()

