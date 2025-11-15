"""Route tests for POST /api/v3/personas/detail endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_persona_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting persona detail."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    # Get a model ID
    model_id = await db.fetchval("SELECT id FROM models WHERE active = true LIMIT 1")
    if not model_id:
        raise ValueError("No active models found in seed data")

    # Create a persona
    persona_id = await db.fetchval(
        "INSERT INTO personas (name, description, active, color, icon, model_id, reasoning, temperature, created_at, updated_at) "
        "VALUES ('Test Persona', 'Test Description', true, '#3B82F6', 'Brain', $1, 'none', 0.7, NOW(), NOW()) RETURNING id",
        model_id,
    )

    # Link persona to department
    await db.execute(
        "INSERT INTO persona_departments (persona_id, department_id, active, created_at, updated_at) "
        "VALUES ($1, $2, true, NOW(), NOW())",
        persona_id,
        dept_id,
    )

    response = await client.post(
        "/api/v3/personas/detail",
        json={"personaId": str(persona_id), "profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["name"] == "Test Persona"
    assert data["description"] == "Test Description"
    assert data["active"] is True
    assert data["color"] == "#3B82F6"
    assert data["icon"] == "Brain"
    assert "can_edit" in data
    assert "can_duplicate" in data
    assert "can_delete" in data
    assert "valid_model_ids" in data
    assert "valid_department_ids" in data
    assert "model_mapping" in data
    assert "department_mapping" in data


async def test_get_persona_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting persona detail for non-existent persona."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/personas/detail",
        json={
            "personaId": "00000000-0000-0000-0000-000000000000",
            "profileId": profile_id,
        },
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

