"""Route tests for POST /api/v3/providers/detail endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_provider_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting provider detail."""
    profile_id = await get_superadmin_alias(db)

    # Create a provider
    provider_id = await db.fetchval(
        "INSERT INTO providers(name, description, api_key) "
        "VALUES('Test Provider', 'Test Description', 'encrypted_key_123') RETURNING id"
    )

    # Add base_url endpoint
    await db.execute(
        "INSERT INTO provider_endpoints(provider_id, base_url) "
        "VALUES($1, 'https://api.test.com')",
        provider_id,
    )

    response = await client.post(
        "/api/v3/providers/detail",
        json={"providerId": str(provider_id), "profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["name"] == "Test Provider"
    assert data["description"] == "Test Description"
    assert data["api_key"] == "encrypted_key_123"  # Returned encrypted
    assert data["base_url"] == "https://api.test.com"


async def test_get_provider_detail_without_endpoint(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting provider detail without endpoint."""
    profile_id = await get_superadmin_alias(db)

    # Create a provider without endpoint
    provider_id = await db.fetchval(
        "INSERT INTO providers(name, description, api_key) "
        "VALUES('Provider No URL', 'Test', 'encrypted_key') RETURNING id"
    )

    response = await client.post(
        "/api/v3/providers/detail",
        json={"providerId": str(provider_id), "profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["name"] == "Provider No URL"
    assert data["base_url"] is None


async def test_get_provider_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting detail for non-existent provider."""
    profile_id = await get_superadmin_alias(db)

    fake_provider_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/providers/detail",
        json={"providerId": fake_provider_id, "profileId": profile_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()
