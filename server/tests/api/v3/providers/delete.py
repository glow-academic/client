"""Route tests for POST /api/v3/providers/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_delete_provider(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a provider that is not in use."""
    profile_id = await get_superadmin_alias(db)

    # Create a provider with no models
    provider_id = await db.fetchval(
        "INSERT INTO providers(name, description, api_key) "
        "VALUES('Deletable Provider', 'Test', 'encrypted_key') RETURNING id"
    )

    response = await client.post(
        "/api/v3/providers/delete",
        json={"providerId": str(provider_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "deleted successfully" in data["message"].lower()

    # Verify provider was deleted
    provider = await db.fetchrow("SELECT * FROM providers WHERE id = $1", provider_id)
    assert provider is None


async def test_delete_provider_in_use_by_personas(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that deleting a provider with models in use by personas fails."""
    profile_id = await get_superadmin_alias(db)

    # Create a provider with a model
    provider_id = await db.fetchval(
        "INSERT INTO providers(name, description, api_key) "
        "VALUES('Used Provider', 'Test', 'encrypted_key') RETURNING id"
    )

    model_id = await db.fetchval(
        "INSERT INTO models(provider_id, name, description, active, custom_model, input_ppm, output_ppm) "
        "VALUES($1, 'Used Model', 'Test', true, false, 10.0, 20.0) RETURNING id",
        provider_id,
    )

    # Use the model in a persona
    await db.execute(
        "INSERT INTO personas(name, description, model_id, active, temperature, reasoning) "
        "VALUES('Test Persona', 'Test', $1, true, 0.7, 'none')",
        model_id,
    )

    response = await client.post(
        "/api/v3/providers/delete",
        json={"providerId": str(provider_id)},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "in use" in data["detail"].lower()
    assert "persona" in data["detail"].lower()

    # Verify provider was not deleted
    provider = await db.fetchrow("SELECT * FROM providers WHERE id = $1", provider_id)
    assert provider is not None


async def test_delete_provider_in_use_by_agents(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that deleting a provider with models in use by agents fails."""
    profile_id = await get_superadmin_alias(db)

    # Create a provider with a model
    provider_id = await db.fetchval(
        "INSERT INTO providers(name, description, api_key) "
        "VALUES('Used Provider', 'Test', 'encrypted_key') RETURNING id"
    )

    model_id = await db.fetchval(
        "INSERT INTO models(provider_id, name, description, active, custom_model, input_ppm, output_ppm) "
        "VALUES($1, 'Used Model', 'Test', true, false, 10.0, 20.0) RETURNING id",
        provider_id,
    )

    # Use the model in an agent
    await db.execute(
        "INSERT INTO agents(name, description, temperature, model_id, reasoning, active) "
        "VALUES('Test Agent', 'Test', 0.7, $1, 'none', true)",
        model_id,
    )

    response = await client.post(
        "/api/v3/providers/delete",
        json={"providerId": str(provider_id)},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "in use" in data["detail"].lower()
    assert "agent" in data["detail"].lower()

    # Verify provider was not deleted
    provider = await db.fetchrow("SELECT * FROM providers WHERE id = $1", provider_id)
    assert provider is not None


async def test_delete_provider_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent provider."""
    profile_id = await get_superadmin_alias(db)

    fake_provider_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/providers/delete",
        json={"providerId": fake_provider_id},
    )

    assert response.status_code == 400
    data = response.json()
    assert "not found" in data["detail"].lower()

