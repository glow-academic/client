"""Route tests for POST /api/v3/providers/duplicate endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_duplicate_provider(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a provider with models."""
    profile_id = await get_superadmin_alias(db)

    # Create a provider with models
    provider_id = await db.fetchval(
        "INSERT INTO providers(name, description, api_key) "
        "VALUES('Original Provider', 'Original Description', 'encrypted_key') RETURNING id"
    )

    # Create models for the provider
    model_id1 = await db.fetchval(
        "INSERT INTO models(provider_id, name, description, active, custom_model, input_ppm, output_ppm) "
        "VALUES($1, 'Model 1', 'Test', true, false, 10.0, 20.0) RETURNING id",
        provider_id,
    )

    model_id2 = await db.fetchval(
        "INSERT INTO models(provider_id, name, description, active, custom_model, input_ppm, output_ppm) "
        "VALUES($1, 'Model 2', 'Test', true, false, 15.0, 25.0) RETURNING id",
        provider_id,
    )

    # Add base_url endpoint
    await db.execute(
        "INSERT INTO provider_endpoints(provider_id, base_url) "
        "VALUES($1, 'https://api.original.com')",
        provider_id,
    )

    response = await client.post(
        "/api/v3/providers/duplicate",
        json={"providerId": str(provider_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "providerId" in data
    assert "duplicated successfully" in data["message"].lower()

    new_provider_id = data["providerId"]
    assert new_provider_id != str(provider_id)

    # Verify new provider was created
    new_provider = await db.fetchrow(
        "SELECT * FROM providers WHERE id = $1", new_provider_id
    )
    original_provider = await db.fetchrow(
        "SELECT * FROM providers WHERE id = $1", provider_id
    )

    assert new_provider is not None
    assert new_provider["name"] == original_provider["name"] + " Copy"
    assert new_provider["description"] == original_provider["description"]
    assert new_provider["api_key"] == original_provider["api_key"]

    # Verify models were duplicated
    new_models = await db.fetch(
        "SELECT * FROM models WHERE provider_id = $1 ORDER BY name", new_provider_id
    )
    assert len(new_models) == 2
    assert new_models[0]["name"] == "Model 1"
    assert new_models[1]["name"] == "Model 2"

    # Verify endpoint was duplicated
    new_endpoint = await db.fetchrow(
        "SELECT * FROM provider_endpoints WHERE provider_id = $1", new_provider_id
    )
    assert new_endpoint is not None
    assert new_endpoint["base_url"] == "https://api.original.com"


async def test_duplicate_provider_without_models(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a provider without models."""
    profile_id = await get_superadmin_alias(db)

    # Create a provider without models
    provider_id = await db.fetchval(
        "INSERT INTO providers(name, description, api_key) "
        "VALUES('Empty Provider', 'Test', 'encrypted_key') RETURNING id"
    )

    response = await client.post(
        "/api/v3/providers/duplicate",
        json={"providerId": str(provider_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    new_provider_id = data["providerId"]

    # Verify new provider was created
    new_provider = await db.fetchrow(
        "SELECT * FROM providers WHERE id = $1", new_provider_id
    )
    assert new_provider is not None

    # Verify no models were created
    new_models = await db.fetch(
        "SELECT * FROM models WHERE provider_id = $1", new_provider_id
    )
    assert len(new_models) == 0


async def test_duplicate_provider_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a non-existent provider."""
    profile_id = await get_superadmin_alias(db)

    fake_provider_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/providers/duplicate",
        json={"providerId": fake_provider_id},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data

