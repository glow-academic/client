"""Route tests for POST /api/v3/providers/create endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_create_provider(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new provider."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/providers/create",
        json={
            "name": "Test Provider",
            "description": "Test Description",
            "api_key": "test_api_key_123",
            "base_url": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "providerId" in data
    assert "Test Provider" in data["message"]

    # Verify provider was created in database
    provider = await db.fetchrow(
        "SELECT * FROM providers WHERE id = $1", data["providerId"]
    )
    assert provider is not None
    assert provider["name"] == "Test Provider"
    assert provider["description"] == "Test Description"
    # API key should be encrypted
    assert provider["api_key"] != "test_api_key_123"
    assert provider["api_key"] is not None


async def test_create_provider_with_base_url(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a provider with base_url."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/providers/create",
        json={
            "name": "Provider With URL",
            "description": "Test",
            "api_key": "test_key",
            "base_url": "https://api.example.com",
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True

    # Verify endpoint was created
    endpoint = await db.fetchrow(
        "SELECT * FROM provider_endpoints WHERE provider_id = $1", data["providerId"]
    )
    assert endpoint is not None
    assert endpoint["base_url"] == "https://api.example.com"


async def test_create_provider_minimal(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a provider with minimal fields."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/providers/create",
        json={
            "name": "Minimal Provider",
            "description": "",
            "api_key": "key",
            "base_url": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True

    # Verify provider was created
    provider = await db.fetchrow(
        "SELECT * FROM providers WHERE id = $1", data["providerId"]
    )
    assert provider is not None
    assert provider["name"] == "Minimal Provider"
