"""Route tests for POST /api/v3/personas/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_delete_persona(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a persona."""
    # Get a model ID
    model_id = await db.fetchval("SELECT id FROM models WHERE active = true LIMIT 1")
    if not model_id:
        raise ValueError("No active models found in seed data")

    # Create a persona
    persona_id = await db.fetchval(
        "INSERT INTO personas (name, description, active, color, icon, model_id, reasoning, temperature, created_at, updated_at) "
        "VALUES ('Persona To Delete', 'Description', true, '#3B82F6', 'Brain', $1, 'none', 0.7, NOW(), NOW()) RETURNING id",
        model_id,
    )

    response = await client.post(
        "/api/v3/personas/delete",
        json={"personaId": str(persona_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Persona 'Persona To Delete' deleted successfully"

    # Verify persona was deleted
    persona = await db.fetchrow("SELECT * FROM personas WHERE id = $1", persona_id)
    assert persona is None


async def test_delete_persona_in_use(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a persona that is in use by scenarios."""
    # Get a model ID
    model_id = await db.fetchval("SELECT id FROM models WHERE active = true LIMIT 1")
    if not model_id:
        raise ValueError("No active models found in seed data")

    # Create a persona
    persona_id = await db.fetchval(
        "INSERT INTO personas (name, description, active, color, icon, model_id, reasoning, temperature, created_at, updated_at) "
        "VALUES ('Persona In Use', 'Description', true, '#3B82F6', 'Brain', $1, 'none', 0.7, NOW(), NOW()) RETURNING id",
        model_id,
    )

    # Create a scenario
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios (name, active) "
        "VALUES ('Test Scenario', true) RETURNING id"
    )

    # Link persona to scenario
    await db.execute(
        "INSERT INTO scenario_personas (scenario_id, persona_id, active, created_at, updated_at) "
        "VALUES ($1, $2, true, NOW(), NOW())",
        scenario_id,
        persona_id,
    )

    response = await client.post(
        "/api/v3/personas/delete",
        json={"personaId": str(persona_id)},
    )

    assert response.status_code == 400
    assert "in use" in response.json()["detail"].lower()


async def test_delete_persona_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent persona."""
    response = await client.post(
        "/api/v3/personas/delete",
        json={"personaId": "00000000-0000-0000-0000-000000000000"},
    )

    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()
