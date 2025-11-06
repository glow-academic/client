"""Route tests for POST /api/v3/agents/duplicate endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_duplicate_agent(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating an agent."""
    profile_id = await get_superadmin_alias(db)

    # Create an agent with prompt and department links
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, description, temperature, model_id, reasoning, active, role) "
        "SELECT 'Original Agent', 'Original Description', 0.7, id, 'medium', true, 'assistant' "
        "FROM models WHERE active = true LIMIT 1 RETURNING id"
    )

    # Create a prompt and link it
    prompt_id = await db.fetchval(
        "INSERT INTO prompts(system_prompt) VALUES ('Original prompt') RETURNING id"
    )
    await db.execute(
        "INSERT INTO agent_prompts(agent_id, prompt_id) VALUES ($1, $2)",
        agent_id,
        prompt_id,
    )

    # Link to a department
    dept_id = await db.fetchval("SELECT id FROM departments LIMIT 1")
    await db.execute(
        "INSERT INTO agent_departments(agent_id, department_id) VALUES ($1, $2)",
        agent_id,
        dept_id,
    )

    response = await client.post(
        "/api/v3/agents/duplicate",
        json={"agentId": str(agent_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "agentId" in data
    assert data["message"] == "Agent duplicated successfully"

    new_agent_id = data["agentId"]
    assert new_agent_id != str(agent_id)

    # Verify new agent was created with same properties
    new_agent = await db.fetchrow("SELECT * FROM agents WHERE id = $1", new_agent_id)
    original_agent = await db.fetchrow("SELECT * FROM agents WHERE id = $1", agent_id)

    assert new_agent is not None
    assert new_agent["name"] == original_agent["name"] + " Copy"
    assert new_agent["description"] == original_agent["description"]
    assert new_agent["temperature"] == original_agent["temperature"]
    assert new_agent["model_id"] == original_agent["model_id"]
    assert new_agent["reasoning"] == original_agent["reasoning"]
    assert new_agent["role"] == original_agent["role"]

    # Verify prompt was duplicated
    new_prompt_link = await db.fetchrow(
        "SELECT prompt_id FROM agent_prompts WHERE agent_id = $1 AND active = true",
        new_agent_id,
    )
    assert new_prompt_link is not None

    # Verify department link was duplicated (if original had one)
    new_dept_link = await db.fetchrow(
        "SELECT * FROM agent_departments WHERE agent_id = $1 AND department_id = $2",
        new_agent_id,
        dept_id,
    )
    assert new_dept_link is not None
    assert new_dept_link["active"] is True


async def test_duplicate_agent_without_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating an agent without department links (cross-department)."""
    profile_id = await get_superadmin_alias(db)

    # Create an agent without department links
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, description, temperature, model_id, reasoning, active, role) "
        "SELECT 'Cross-Dept Agent', 'Test', 0.7, id, 'medium', true, 'assistant' "
        "FROM models WHERE active = true LIMIT 1 RETURNING id"
    )

    # Create a prompt and link it
    prompt_id = await db.fetchval(
        "INSERT INTO prompts(system_prompt) VALUES ('Test prompt') RETURNING id"
    )
    await db.execute(
        "INSERT INTO agent_prompts(agent_id, prompt_id) VALUES ($1, $2)",
        agent_id,
        prompt_id,
    )

    response = await client.post(
        "/api/v3/agents/duplicate",
        json={"agentId": str(agent_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    new_agent_id = data["agentId"]

    # Verify no department links were created (original had none)
    dept_links = await db.fetch(
        "SELECT * FROM agent_departments WHERE agent_id = $1",
        new_agent_id,
    )
    assert len(dept_links) == 0


async def test_duplicate_agent_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a non-existent agent."""
    profile_id = await get_superadmin_alias(db)

    fake_agent_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/agents/duplicate",
        json={"agentId": fake_agent_id},
    )

    assert response.status_code == 500
    data = response.json()
    assert "detail" in data

