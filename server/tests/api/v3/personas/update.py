"""Route tests for POST /api/v3/personas/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_update_persona(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a persona."""
    dept_id = await get_cs_dept_id(db)

    # Get a model ID
    model_id = await db.fetchval("SELECT id FROM models WHERE active = true LIMIT 1")
    if not model_id:
        raise ValueError("No active models found in seed data")

    # Create a persona
    persona_id = await db.fetchval(
        "INSERT INTO personas (name, description, active, color, icon, model_id, reasoning, temperature, created_at, updated_at) "
        "VALUES ('Original Persona', 'Original Description', true, '#3B82F6', 'Brain', $1, 'none', 0.7, NOW(), NOW()) RETURNING id",
        model_id,
    )

    response = await client.post(
        "/api/v3/personas/update",
        json={
            "personaId": str(persona_id),
            "name": "Updated Persona",
            "description": "Updated Description",
            "department_ids": [str(dept_id)],
            "active": False,
            "color": "#EF4444",
            "icon": "User",
            "model_id": str(model_id),
            "reasoning": "medium",
            "temperature": 0.5,
            "system_prompt": "Updated prompt",
            "prompt_id": None,
            "department_id": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Persona 'Updated Persona' updated successfully"

    # Verify persona was updated
    persona = await db.fetchrow("SELECT * FROM personas WHERE id = $1", persona_id)
    assert persona is not None
    assert persona["name"] == "Updated Persona"
    assert persona["description"] == "Updated Description"
    assert persona["active"] is False
    assert abs(persona["temperature"] - 0.5) < 0.001

    # Verify department link was created
    dept_link = await db.fetchrow(
        "SELECT * FROM persona_departments WHERE persona_id = $1 AND department_id = $2 AND active = true",
        persona_id,
        dept_id,
    )
    assert dept_link is not None


async def test_update_persona_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent persona."""
    # Get a model ID
    model_id = await db.fetchval("SELECT id FROM models WHERE active = true LIMIT 1")
    if not model_id:
        raise ValueError("No active models found in seed data")

    response = await client.post(
        "/api/v3/personas/update",
        json={
            "personaId": "00000000-0000-0000-0000-000000000000",
            "name": "Updated Persona",
            "description": None,
            "department_ids": None,
            "active": True,
            "color": "#3B82F6",
            "icon": "Brain",
            "model_id": str(model_id),
            "reasoning": None,
            "temperature": 0.7,
            "system_prompt": None,
            "prompt_id": None,
            "department_id": None,
        },
    )

    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()

