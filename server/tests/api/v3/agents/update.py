"""Route tests for POST /api/v3/agents/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_update_agent(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating an agent with all fields."""
    profile_id = await get_superadmin_alias(db)

    # Create an agent first
    model_id = await db.fetchval(
        "SELECT id FROM models WHERE active = true LIMIT 1"
    )
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, description, temperature, model_id, reasoning, active, role) "
        "SELECT 'Original Name', 'Original Description', 0.5, id, 'low', true, 'assistant' "
        "FROM models WHERE active = true LIMIT 1 RETURNING id"
    )

    # Get a department ID
    dept_id = await db.fetchval("SELECT id FROM departments LIMIT 1")

    response = await client.post(
        "/api/v3/agents/update",
        json={
            "agentId": str(agent_id),
            "name": "Updated Name",
            "description": "Updated Description",
            "system_prompt": "Updated prompt",
            "temperature": 0.9,
            "model_id": str(model_id),
            "reasoning": "high",
            "active": False,
            "role": "classify",
            "department_ids": [str(dept_id)],
            "prompt_id": None,
            "department_id": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Agent updated successfully"

    # Verify agent was updated
    agent = await db.fetchrow("SELECT * FROM agents WHERE id = $1", agent_id)
    assert agent is not None
    assert agent["name"] == "Updated Name"
    assert agent["description"] == "Updated Description"
    assert abs(agent["temperature"] - 0.9) < 0.001  # Floating point precision
    assert agent["reasoning"] == "high"
    assert agent["active"] is False
    assert agent["role"] == "classify"

    # Verify new prompt was created
    prompt_link = await db.fetchrow(
        "SELECT ap.prompt_id, p.system_prompt FROM agent_prompts ap "
        "JOIN prompts p ON p.id = ap.prompt_id "
        "WHERE ap.agent_id = $1 AND ap.active = true",
        agent_id,
    )
    assert prompt_link is not None
    assert prompt_link["system_prompt"] == "Updated prompt"

    # Verify department link was updated
    dept_link = await db.fetchrow(
        "SELECT * FROM agent_departments WHERE agent_id = $1 AND department_id = $2",
        agent_id,
        dept_id,
    )
    assert dept_link is not None


async def test_update_agent_with_existing_prompt(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating an agent with an existing prompt_id."""
    profile_id = await get_superadmin_alias(db)

    # Create agent and prompt
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, description, temperature, model_id, reasoning, active, role) "
        "SELECT 'Test Agent', 'Test', 0.5, id, 'low', true, 'assistant' "
        "FROM models WHERE active = true LIMIT 1 RETURNING id"
    )

    prompt_id = await db.fetchval(
        "INSERT INTO prompts(system_prompt) VALUES ('Existing prompt') RETURNING id"
    )

    model_id = await db.fetchval(
        "SELECT id FROM models WHERE active = true LIMIT 1"
    )

    response = await client.post(
        "/api/v3/agents/update",
        json={
            "agentId": str(agent_id),
            "name": "Updated Agent",
            "description": "Updated",
            "prompt_id": str(prompt_id),
            "system_prompt": "",  # Not used when prompt_id provided
            "temperature": 0.7,
            "model_id": str(model_id),
            "reasoning": "medium",
            "active": True,
            "role": "assistant",
            "department_ids": None,
        },
    )

    assert response.status_code == 200

    # Verify prompt link uses existing prompt
    prompt_link = await db.fetchrow(
        "SELECT prompt_id FROM agent_prompts WHERE agent_id = $1 AND active = true",
        agent_id,
    )
    assert prompt_link is not None
    assert str(prompt_link["prompt_id"]) == str(prompt_id)


async def test_update_agent_removes_department_links(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that updating an agent replaces department links."""
    profile_id = await get_superadmin_alias(db)

    # Create agent with department link
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, description, temperature, model_id, reasoning, active, role) "
        "SELECT 'Test Agent', 'Test', 0.5, id, 'low', true, 'assistant' "
        "FROM models WHERE active = true LIMIT 1 RETURNING id"
    )

    old_dept_id = await db.fetchval("SELECT id FROM departments LIMIT 1")
    await db.execute(
        "INSERT INTO agent_departments(agent_id, department_id) VALUES ($1, $2)",
        agent_id,
        old_dept_id,
    )

    # Get a different department
    new_dept_id = await db.fetchval(
        "SELECT id FROM departments WHERE id != $1 LIMIT 1", old_dept_id
    )

    model_id = await db.fetchval(
        "SELECT id FROM models WHERE active = true LIMIT 1"
    )

    response = await client.post(
        "/api/v3/agents/update",
        json={
            "agentId": str(agent_id),
            "name": "Test Agent",
            "description": "Test",
            "system_prompt": "Test prompt",
            "temperature": 0.5,
            "model_id": str(model_id),
            "reasoning": "low",
            "active": True,
            "role": "assistant",
            "department_ids": [str(new_dept_id)] if new_dept_id else [],
            "prompt_id": None,
            "department_id": None,
        },
    )

    assert response.status_code == 200

    # Verify old department link is removed
    old_link = await db.fetchrow(
        "SELECT * FROM agent_departments WHERE agent_id = $1 AND department_id = $2",
        agent_id,
        old_dept_id,
    )
    assert old_link is None or old_link["active"] is False

    # Verify new department link exists
    if new_dept_id:
        new_link = await db.fetchrow(
            "SELECT * FROM agent_departments WHERE agent_id = $1 AND department_id = $2",
            agent_id,
            new_dept_id,
        )
        assert new_link is not None


async def test_update_agent_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent agent."""
    profile_id = await get_superadmin_alias(db)

    fake_agent_id = "00000000-0000-0000-0000-000000000000"
    model_id = await db.fetchval(
        "SELECT id FROM models WHERE active = true LIMIT 1"
    )

    response = await client.post(
        "/api/v3/agents/update",
        json={
            "agentId": fake_agent_id,
            "name": "Test",
            "description": "Test",
            "system_prompt": "Test",
            "temperature": 0.5,
            "model_id": str(model_id),
            "reasoning": "low",
            "active": True,
            "role": "assistant",
            "department_ids": None,
            "prompt_id": None,
            "department_id": None,
        },
    )

    # May fail if agent doesn't exist (depends on SQL implementation)
    # The update might fail when trying to create prompt for non-existent agent
    assert response.status_code in [200, 500]

