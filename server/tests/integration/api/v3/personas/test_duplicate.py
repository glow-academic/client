"""Route tests for POST /api/v3/personas/duplicate endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_duplicate_persona(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a persona."""
    dept_id = await get_cs_dept_id(db)

    # Get a model ID
    model_id = await db.fetchval("SELECT id FROM models WHERE active = true LIMIT 1")
    if not model_id:
        raise ValueError("No active models found in seed data")

    # Create a persona with department link
    persona_id = await db.fetchval(
        "INSERT INTO personas (name, description, active, color, icon, model_id, reasoning, temperature, created_at, updated_at) "
        "VALUES ('Original Persona', 'Original Description', true, '#3B82F6', 'Brain', $1, 'none', 0.7, NOW(), NOW()) RETURNING id",
        model_id,
    )

    # Link persona to department
    await db.execute(
        "INSERT INTO persona_departments (persona_id, department_id, active, created_at, updated_at) "
        "VALUES ($1, $2, true, NOW(), NOW())",
        persona_id,
        dept_id,
    )

    # Create a prompt and link it
    prompt_id = await db.fetchval(
        "INSERT INTO prompts (system_prompt, created_at, updated_at) "
        "VALUES ('Test prompt', NOW(), NOW()) RETURNING id"
    )
    await db.execute(
        "INSERT INTO persona_prompts (persona_id, prompt_id, active, created_at, updated_at) "
        "VALUES ($1, $2, true, NOW(), NOW())",
        persona_id,
        prompt_id,
    )

    response = await client.post(
        "/api/v3/personas/duplicate",
        json={"personaId": str(persona_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "personaId" in data
    assert data["personaId"] != str(persona_id)  # Should be a new ID
    assert data["message"] == "Persona 'Original Persona' duplicated successfully"

    # Verify duplicated persona exists
    duplicated = await db.fetchrow(
        "SELECT * FROM personas WHERE id = $1", data["personaId"]
    )
    assert duplicated is not None
    assert duplicated["name"] == "Original Persona Copy"  # SQL adds " Copy"
    assert duplicated["description"] == "Original Description"
    assert abs(duplicated["temperature"] - 0.7) < 0.001

    # Verify department link was copied (like agents/scenarios/simulations)
    dept_link = await db.fetchrow(
        "SELECT * FROM persona_departments WHERE persona_id = $1 AND department_id = $2 AND active = true",
        data["personaId"],
        dept_id,
    )
    assert dept_link is not None


async def test_duplicate_persona_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a non-existent persona."""
    response = await client.post(
        "/api/v3/personas/duplicate",
        json={"personaId": "00000000-0000-0000-0000-000000000000"},
    )

    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()
