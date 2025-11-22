"""Route tests for POST /api/v3/providers/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_list_providers(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting providers list with nested models."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/providers/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "providers" in data
    assert isinstance(data["providers"], list)
    assert len(data["providers"]) >= 0

    # If there are providers, verify structure
    if data["providers"]:
        for provider in data["providers"]:
            assert "provider_id" in provider
            assert "name" in provider
            assert "description" in provider
            assert "can_edit" in provider
            assert "can_delete" in provider
            assert "models" in provider
            assert isinstance(provider["models"], list)


async def test_list_providers_with_models(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test providers list includes models with usage counts."""
    profile_id = await get_superadmin_alias(db)

    # Create a provider with a model
    provider_id = await db.fetchval(
        "INSERT INTO providers(name, description, api_key) "
        "VALUES('Test Provider', 'Test', 'encrypted_key') RETURNING id"
    )

    # Create a model for the provider
    model_id = await db.fetchval(
        "INSERT INTO models(provider_id, name, description, active, custom_model, input_ppm, output_ppm) "
        "VALUES($1, 'Test Model', 'Test', true, false, 10.0, 20.0) RETURNING id",
        provider_id,
    )

    # Create a persona using the model (to test usage count)
    await db.fetchval(
        "INSERT INTO personas(name, description, model_id, active, temperature, reasoning, color, icon) "
        "VALUES('Test Persona', 'Test', $1, true, 0.7, 'none', '#000000', 'user') RETURNING id",
        model_id,
    )

    response = await client.post(
        "/api/v3/providers/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    # Find our provider
    test_provider = next(
        (p for p in data["providers"] if p["provider_id"] == str(provider_id)), None
    )
    assert test_provider is not None
    assert len(test_provider["models"]) >= 1

    # Find our model
    test_model = next(
        (m for m in test_provider["models"] if m["model_id"] == str(model_id)), None
    )
    assert test_model is not None
    assert test_model["name"] == "Test Model"
    assert test_model["can_delete"] is False  # In use by persona


async def test_list_providers_model_usage_calculation(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that model usage is calculated correctly from persona and agent usage."""
    profile_id = await get_superadmin_alias(db)

    # Create a provider with a model
    provider_id = await db.fetchval(
        "INSERT INTO providers(name, description, api_key) "
        "VALUES('Usage Test Provider', 'Test', 'encrypted_key') RETURNING id"
    )

    model_id = await db.fetchval(
        "INSERT INTO models(provider_id, name, description, active, custom_model, input_ppm, output_ppm) "
        "VALUES($1, 'Usage Test Model', 'Test', true, false, 10.0, 20.0) RETURNING id",
        provider_id,
    )

    # Create personas and agents using the model
    await db.execute(
        "INSERT INTO personas(name, description, model_id, active, temperature, reasoning, color, icon) "
        "SELECT 'Persona ' || generate_series(1, 5), 'Test', $1, true, 0.7, 'none', '#000000', 'user'",
        model_id,
    )

    await db.execute(
        "INSERT INTO agents(name, description, temperature, model_id, reasoning, active) "
        "SELECT 'Agent ' || generate_series(1, 3), 'Test', 0.7, $1, 'none', true",
        model_id,
    )

    response = await client.post(
        "/api/v3/providers/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    # Find our provider and model
    test_provider = next(
        (p for p in data["providers"] if p["provider_id"] == str(provider_id)), None
    )
    assert test_provider is not None

    test_model = next(
        (m for m in test_provider["models"] if m["model_id"] == str(model_id)), None
    )
    assert test_model is not None
    # Model with 8 total usages (5 personas + 3 agents) should not be deletable
    assert test_model["can_delete"] is False


async def test_list_providers_can_delete_based_on_models(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that provider can_delete is based on whether all models are deletable."""
    profile_id = await get_superadmin_alias(db)

    # Create provider with used model
    provider_id1 = await db.fetchval(
        "INSERT INTO providers(name, description, api_key) "
        "VALUES('Provider with Used Model', 'Test', 'encrypted_key') RETURNING id"
    )

    model_id1 = await db.fetchval(
        "INSERT INTO models(provider_id, name, description, active, custom_model, input_ppm, output_ppm) "
        "VALUES($1, 'Used Model', 'Test', true, false, 10.0, 20.0) RETURNING id",
        provider_id1,
    )

    # Use the model
    await db.execute(
        "INSERT INTO personas(name, description, model_id, active, temperature, reasoning, color, icon) "
        "VALUES('Test Persona', 'Test', $1, true, 0.7, 'none', '#000000', 'user')",
        model_id1,
    )

    # Create provider with no models
    provider_id2 = await db.fetchval(
        "INSERT INTO providers(name, description, api_key) "
        "VALUES('Provider with No Models', 'Test', 'encrypted_key') RETURNING id"
    )

    response = await client.post(
        "/api/v3/providers/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    # Find providers
    provider1 = next(
        (p for p in data["providers"] if p["provider_id"] == str(provider_id1)), None
    )
    provider2 = next(
        (p for p in data["providers"] if p["provider_id"] == str(provider_id2)), None
    )

    assert provider1 is not None
    assert provider2 is not None

    # Provider with used model should not be deletable
    assert provider1["can_delete"] is False
    # Provider with no models should be deletable
    assert provider2["can_delete"] is True


async def test_list_providers_permissions_superadmin(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test superadmin has edit permissions."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/providers/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    # Superadmin should have edit permissions
    for provider in data["providers"]:
        assert provider["can_edit"] is True


async def test_list_providers_permissions_non_superadmin(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test non-superadmin does not have edit permissions."""
    # Create a non-superadmin profile
    ta_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, email, role) "
        "VALUES('Test', 'TA', 'redacted@purdue.edu', 'ta') RETURNING id"
    )

    response = await client.post(
        "/api/v3/providers/list",
        json={"profileId": str(ta_id)},
    )

    assert response.status_code == 200
    data = response.json()

    # TA should not have edit permissions
    for provider in data["providers"]:
        assert provider["can_edit"] is False
