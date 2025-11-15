"""Route tests for POST /api/v3/personas/create endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_create_persona_minimal(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a persona with minimal fields."""
    # Get a model ID
    model_id = await db.fetchval("SELECT id FROM models WHERE active = true LIMIT 1")
    if not model_id:
        raise ValueError("No active models found in seed data")

    response = await client.post(
        "/api/v3/personas/create",
        json={
            "name": "New Persona",
            "description": "",
            "department_ids": None,
            "active": True,
            "color": "#3B82F6",
            "icon": "Brain",
            "model_id": str(model_id),
            "reasoning": None,
            "temperature": 0.7,
            "system_prompt": None,
            "prompt_id": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "personaId" in data
    assert data["message"] == "Persona 'New Persona' created successfully"

    # Verify persona was created
    persona = await db.fetchrow(
        "SELECT * FROM personas WHERE id = $1", data["personaId"]
    )
    assert persona is not None
    assert persona["name"] == "New Persona"
    assert persona["active"] is True


async def test_create_persona_with_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a persona with department links."""
    dept_id = await get_cs_dept_id(db)

    # Get a model ID
    model_id = await db.fetchval("SELECT id FROM models WHERE active = true LIMIT 1")
    if not model_id:
        raise ValueError("No active models found in seed data")

    response = await client.post(
        "/api/v3/personas/create",
        json={
            "name": "Department Persona",
            "description": "Test Description",
            "department_ids": [str(dept_id)],
            "active": True,
            "color": "#EF4444",
            "icon": "User",
            "model_id": str(model_id),
            "reasoning": "medium",
            "temperature": 0.5,
            "system_prompt": "You are a helpful assistant.",
            "prompt_id": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True

    # Verify department link was created
    dept_link = await db.fetchrow(
        "SELECT * FROM persona_departments WHERE persona_id = $1 AND department_id = $2 AND active = true",
        data["personaId"],
        dept_id,
    )
    assert dept_link is not None

    # Verify prompt was created and linked
    prompt_link = await db.fetchrow(
        "SELECT * FROM persona_prompts WHERE persona_id = $1 AND active = true",
        data["personaId"],
    )
    assert prompt_link is not None


async def test_create_persona_with_existing_prompt(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a persona with an existing prompt ID."""
    # Get a model ID
    model_id = await db.fetchval("SELECT id FROM models WHERE active = true LIMIT 1")
    if not model_id:
        raise ValueError("No active models found in seed data")

    # Create a prompt first
    prompt_id = await db.fetchval(
        "INSERT INTO prompts (system_prompt, created_at, updated_at) "
        "VALUES ('Existing prompt', NOW(), NOW()) RETURNING id"
    )

    response = await client.post(
        "/api/v3/personas/create",
        json={
            "name": "Persona With Prompt",
            "description": "",
            "department_ids": None,
            "active": True,
            "color": "#10B981",
            "icon": "Sparkles",
            "model_id": str(model_id),
            "reasoning": None,
            "temperature": 0.0,
            "system_prompt": None,
            "prompt_id": str(prompt_id),
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True

    # Verify prompt link was created
    prompt_link = await db.fetchrow(
        "SELECT * FROM persona_prompts WHERE persona_id = $1 AND prompt_id = $2 AND active = true",
        data["personaId"],
        prompt_id,
    )
    assert prompt_link is not None
