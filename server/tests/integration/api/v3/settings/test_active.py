"""Route tests for POST /api/v3/settings/active endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_active_settings(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting active settings."""
    profile_id = await get_superadmin_alias(db)

    # Create an active settings row first
    settings_id = await db.fetchval(
        "INSERT INTO settings (active, primary_color) "
        "VALUES (true, '#3B82F6') RETURNING id"
    )

    response = await client.post(
        "/api/v3/settings/active",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "settings_id" in data
    assert data["settings_id"] == str(settings_id)
    assert "created_at" in data
    assert "active" in data
    assert data["active"] is True
    assert "tokens" in data


async def test_get_active_settings_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting active settings when none exist."""
    profile_id = await get_superadmin_alias(db)

    # Deactivate all settings
    await db.execute("UPDATE settings SET active = false WHERE active = true")

    response = await client.post(
        "/api/v3/settings/active",
        json={"profileId": profile_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "no active settings" in data["detail"].lower()


async def test_get_active_settings_caching(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that active settings endpoint uses caching."""
    profile_id = await get_superadmin_alias(db)

    # Create an active settings row
    settings_id = await db.fetchval(
        "INSERT INTO settings (active, primary_color) "
        "VALUES (true, '#FF0000') RETURNING id"
    )

    # First request
    response1 = await client.post(
        "/api/v3/settings/active",
        json={"profileId": profile_id},
    )

    assert response1.status_code == 200
    assert response1.headers.get("X-Cache-Hit") == "0"  # Cache miss
    assert response1.headers.get("X-Cache-Tags") == "settings"

    # Second request (should hit cache)
    response2 = await client.post(
        "/api/v3/settings/active",
        json={"profileId": profile_id},
    )

    assert response2.status_code == 200
    assert response2.headers.get("X-Cache-Hit") == "1"  # Cache hit
    assert response2.headers.get("X-Cache-Tags") == "settings"
    assert response2.json()["settings_id"] == str(settings_id)
