"""Route tests for POST /api/v3/agents/create endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_create_agent(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new agent with all fields."""
    profile_id = await get_superadmin_alias(db)

    # Get a model ID for the agent
    model_id = await db.fetchval("SELECT id FROM models WHERE active = true LIMIT 1")
    assert model_id is not None

    # Get a department ID
    dept_id = await db.fetchval("SELECT id FROM departments LIMIT 1")
    assert dept_id is not None

    response = await client.post(
        "/api/v3/agents/create",
        json={
            "name": "Test Agent",
            "description": "Test Description",
            "system_prompt": "You are a helpful assistant.",
            "temperature": 0.7,
            "model_id": str(model_id),
            "reasoning": "medium",
            "active": True,
            "role": "assistant",
            "department_ids": [str(dept_id)],
            "prompt_id": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "agentId" in data
    assert data["message"] == "Agent created successfully"

    # Verify agent was created in database
    agent = await db.fetchrow("SELECT * FROM agents WHERE id = $1", data["agentId"])
    assert agent is not None
    assert agent["name"] == "Test Agent"
    assert agent["description"] == "Test Description"
    assert abs(agent["temperature"] - 0.7) < 0.001  # Floating point precision
    assert agent["model_id"] == model_id
    assert agent["reasoning"] == "medium"
    assert agent["active"] is True
    assert agent["role"] == "assistant"

    # Verify prompt was created and linked
    prompt_link = await db.fetchrow(
        "SELECT * FROM agent_prompts WHERE agent_id = $1 AND active = true",
        data["agentId"],
    )
    assert prompt_link is not None

    # Verify department link was created
    dept_link = await db.fetchrow(
        "SELECT * FROM agent_departments WHERE agent_id = $1 AND department_id = $2",
        data["agentId"],
        dept_id,
    )
    assert dept_link is not None


async def test_create_agent_with_existing_prompt(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating an agent with an existing prompt_id."""
    profile_id = await get_superadmin_alias(db)

    # Create a prompt first
    prompt_id = await db.fetchval(
        "INSERT INTO prompts(system_prompt) VALUES ('Existing prompt') RETURNING id"
    )

    model_id = await db.fetchval("SELECT id FROM models WHERE active = true LIMIT 1")

    response = await client.post(
        "/api/v3/agents/create",
        json={
            "name": "Agent With Prompt",
            "description": "Test",
            "prompt_id": str(prompt_id),
            "system_prompt": "",  # Not used when prompt_id is provided
            "temperature": 0.5,
            "model_id": str(model_id),
            "reasoning": "low",
            "active": True,
            "role": "assistant",
            "department_ids": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True

    # Verify prompt link uses existing prompt
    prompt_link = await db.fetchrow(
        "SELECT prompt_id FROM agent_prompts WHERE agent_id = $1 AND active = true",
        data["agentId"],
    )
    assert prompt_link is not None
    assert str(prompt_link["prompt_id"]) == str(prompt_id)


async def test_create_agent_without_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating an agent without department links (cross-department)."""
    profile_id = await get_superadmin_alias(db)

    model_id = await db.fetchval("SELECT id FROM models WHERE active = true LIMIT 1")

    response = await client.post(
        "/api/v3/agents/create",
        json={
            "name": "Cross-Dept Agent",
            "description": "Available to all departments",
            "system_prompt": "Cross-department agent",
            "temperature": 0.8,
            "model_id": str(model_id),
            "reasoning": "high",
            "active": True,
            "role": "assistant",
            "department_ids": None,
            "prompt_id": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True

    # Verify no department links were created
    dept_links = await db.fetch(
        "SELECT * FROM agent_departments WHERE agent_id = $1",
        data["agentId"],
    )
    assert len(dept_links) == 0


async def test_create_agent_invalid_model(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating an agent with invalid model_id."""
    profile_id = await get_superadmin_alias(db)

    fake_model_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/agents/create",
        json={
            "name": "Invalid Agent",
            "description": "Test",
            "system_prompt": "Test prompt",
            "temperature": 0.7,
            "model_id": fake_model_id,
            "reasoning": "medium",
            "active": True,
            "role": "assistant",
            "department_ids": None,
            "prompt_id": None,
        },
    )

    # Should fail due to foreign key constraint or validation
    assert response.status_code in [400, 422, 500]
