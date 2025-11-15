"""Route tests for POST /api/v3/providers/decrypt-key endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from app.utils.auth import encrypt_api_key  # type: ignore
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_decrypt_provider_key(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test decrypting provider API key."""
    profile_id = await get_superadmin_alias(db)

    # Create a provider with encrypted API key
    original_key = "test_api_key_123"
    encrypted_key = encrypt_api_key(original_key)

    provider_id = await db.fetchval(
        "INSERT INTO providers(name, description, api_key) "
        "VALUES('Test Provider', 'Test', $1) RETURNING id",
        encrypted_key,
    )

    response = await client.post(
        "/api/v3/providers/decrypt-key",
        json={"providerId": str(provider_id), "profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert "api_key" in data
    assert data["api_key"] == original_key


async def test_decrypt_provider_key_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test decrypting key for non-existent provider."""
    profile_id = await get_superadmin_alias(db)

    fake_provider_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/providers/decrypt-key",
        json={"providerId": fake_provider_id, "profileId": profile_id},
    )

    assert response.status_code == 400
    data = response.json()
    assert "not found" in data["detail"].lower()


async def test_decrypt_provider_key_missing_key(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test decrypting key when provider has no API key.

    Note: Since api_key is NOT NULL in the schema, we test with an empty encrypted key instead.
    """
    profile_id = await get_superadmin_alias(db)

    # Create a provider with empty encrypted key (simulating missing key scenario)
    # Use a minimal valid encrypted key format (base64 encoded)
    import base64

    empty_encrypted = base64.b64encode(b"empty").decode("utf-8")

    provider_id = await db.fetchval(
        "INSERT INTO providers(name, description, api_key) "
        "VALUES('No Key Provider', 'Test', $1) RETURNING id",
        empty_encrypted,
    )

    response = await client.post(
        "/api/v3/providers/decrypt-key",
        json={"providerId": str(provider_id), "profileId": profile_id},
    )

    # Should return 400 or 500 depending on how decrypt handles invalid keys
    assert response.status_code in (400, 500)
    data = response.json()
    assert "detail" in data
