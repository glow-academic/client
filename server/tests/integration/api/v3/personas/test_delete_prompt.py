"""Route tests for POST /api/v3/personas/delete-prompt endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_delete_persona_prompt_default(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a default persona prompt."""
    # Get a model ID
    model_id = await db.fetchval("SELECT id FROM models WHERE active = true LIMIT 1")
    if not model_id:
        raise ValueError("No active models found in seed data")

    # Create a persona
    persona_id = await db.fetchval(
        "INSERT INTO personas (name, description, active, color, icon, model_id, reasoning, temperature, created_at, updated_at) "
        "VALUES ('Test Persona', 'Description', true, '#3B82F6', 'Brain', $1, 'none', 0.7, NOW(), NOW()) RETURNING id",
        model_id,
    )

    # Create a prompt and link it as default
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
        "/api/v3/personas/delete-prompt",
        json={
            "personaId": str(persona_id),
            "promptId": str(prompt_id),
            "departmentId": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Prompt deleted successfully"

    # Verify prompt link was deactivated
    prompt_link = await db.fetchrow(
        "SELECT * FROM persona_prompts WHERE persona_id = $1 AND prompt_id = $2 AND active = true",
        persona_id,
        prompt_id,
    )
    assert prompt_link is None


async def test_delete_persona_prompt_department(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a department-specific persona prompt."""
    dept_id = await get_cs_dept_id(db)

    # Get a model ID
    model_id = await db.fetchval("SELECT id FROM models WHERE active = true LIMIT 1")
    if not model_id:
        raise ValueError("No active models found in seed data")

    # Create a persona
    persona_id = await db.fetchval(
        "INSERT INTO personas (name, description, active, color, icon, model_id, reasoning, temperature, created_at, updated_at) "
        "VALUES ('Test Persona', 'Description', true, '#3B82F6', 'Brain', $1, 'none', 0.7, NOW(), NOW()) RETURNING id",
        model_id,
    )

    # Create a prompt and link it as department-specific
    prompt_id = await db.fetchval(
        "INSERT INTO prompts (system_prompt, created_at, updated_at) "
        "VALUES ('Dept prompt', NOW(), NOW()) RETURNING id"
    )
    await db.execute(
        "INSERT INTO persona_department_prompts (persona_id, department_id, prompt_id, active, created_at, updated_at) "
        "VALUES ($1, $2, $3, true, NOW(), NOW())",
        persona_id,
        dept_id,
        prompt_id,
    )

    response = await client.post(
        "/api/v3/personas/delete-prompt",
        json={
            "personaId": str(persona_id),
            "promptId": str(prompt_id),
            "departmentId": str(dept_id),
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True

    # Verify department prompt link was deactivated
    dept_prompt_link = await db.fetchrow(
        "SELECT * FROM persona_department_prompts WHERE persona_id = $1 AND department_id = $2 AND prompt_id = $3 AND active = true",
        persona_id,
        dept_id,
        prompt_id,
    )
    assert dept_prompt_link is None
