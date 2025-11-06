"""Route tests for POST /api/v3/providers/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_update_provider(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a provider."""
    profile_id = await get_superadmin_alias(db)

    # Create a provider first
    provider_id = await db.fetchval(
        "INSERT INTO providers(name, description, api_key) "
        "VALUES('Original Name', 'Original Description', 'encrypted_key') RETURNING id"
    )

    response = await client.post(
        "/api/v3/providers/update",
        json={
            "providerId": str(provider_id),
            "name": "Updated Name",
            "description": "Updated Description",
            "api_key": None,  # Don't update API key
            "base_url": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "Updated Name" in data["message"]

    # Verify provider was updated
    provider = await db.fetchrow("SELECT * FROM providers WHERE id = $1", provider_id)
    assert provider is not None
    assert provider["name"] == "Updated Name"
    assert provider["description"] == "Updated Description"
    # API key should remain unchanged
    assert provider["api_key"] == "encrypted_key"


async def test_update_provider_with_api_key(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a provider with new API key."""
    profile_id = await get_superadmin_alias(db)

    # Create a provider first
    provider_id = await db.fetchval(
        "INSERT INTO providers(name, description, api_key) "
        "VALUES('Test Provider', 'Test', 'old_encrypted_key') RETURNING id"
    )

    response = await client.post(
        "/api/v3/providers/update",
        json={
            "providerId": str(provider_id),
            "name": "Test Provider",
            "description": "Test",
            "api_key": "new_api_key_456",
            "base_url": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True

    # Verify API key was updated (and encrypted)
    provider = await db.fetchrow("SELECT * FROM providers WHERE id = $1", provider_id)
    assert provider is not None
    assert provider["api_key"] != "old_encrypted_key"
    assert provider["api_key"] != "new_api_key_456"  # Should be encrypted


async def test_update_provider_with_base_url(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a provider with base_url."""
    profile_id = await get_superadmin_alias(db)

    # Create a provider first
    provider_id = await db.fetchval(
        "INSERT INTO providers(name, description, api_key) "
        "VALUES('Test Provider', 'Test', 'encrypted_key') RETURNING id"
    )

    response = await client.post(
        "/api/v3/providers/update",
        json={
            "providerId": str(provider_id),
            "name": "Test Provider",
            "description": "Test",
            "api_key": None,
            "base_url": "https://api.updated.com",
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True

    # Verify endpoint was created/updated
    endpoint = await db.fetchrow(
        "SELECT * FROM provider_endpoints WHERE provider_id = $1", provider_id
    )
    assert endpoint is not None
    assert endpoint["base_url"] == "https://api.updated.com"


async def test_update_provider_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent provider."""
    profile_id = await get_superadmin_alias(db)

    fake_provider_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/providers/update",
        json={
            "providerId": fake_provider_id,
            "name": "Test",
            "description": "Test",
            "api_key": None,
            "base_url": None,
        },
    )

    assert response.status_code == 400
    data = response.json()
    assert "not found" in data["detail"].lower()

