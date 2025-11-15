"""Route tests for POST /api/v3/agents/delete-prompt endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_delete_agent_prompt_default(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a default agent prompt (when multiple prompts exist)."""
    await get_superadmin_alias(db)

    # Create an agent
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, description, temperature, model_id, reasoning, active, role) "
        "SELECT 'Test Agent', 'Test', 0.7, id, 'medium', true, 'assistant' "
        "FROM models WHERE active = true LIMIT 1 RETURNING id"
    )

    # Create two prompts - only one can be active at a time
    prompt1_id = await db.fetchval(
        "INSERT INTO prompts(system_prompt) VALUES ('Prompt 1') RETURNING id"
    )
    prompt2_id = await db.fetchval(
        "INSERT INTO prompts(system_prompt) VALUES ('Prompt 2') RETURNING id"
    )

    # Link first prompt as active
    await db.execute(
        "INSERT INTO agent_prompts(agent_id, prompt_id, active) VALUES ($1, $2, true)",
        agent_id,
        prompt1_id,
    )
    # Link second prompt as inactive (can't have two active)
    await db.execute(
        "INSERT INTO agent_prompts(agent_id, prompt_id, active) VALUES ($1, $2, false)",
        agent_id,
        prompt2_id,
    )

    response = await client.post(
        "/api/v3/agents/delete-prompt",
        json={
            "agentId": str(agent_id),
            "promptId": str(prompt1_id),
            "departmentId": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Prompt deleted successfully"

    # Verify prompt link was deactivated
    prompt_link = await db.fetchrow(
        "SELECT active FROM agent_prompts WHERE agent_id = $1 AND prompt_id = $2",
        agent_id,
        prompt1_id,
    )
    assert prompt_link is not None
    assert prompt_link["active"] is False


async def test_delete_agent_prompt_department_specific(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a department-specific agent prompt."""
    await get_superadmin_alias(db)

    # Create an agent
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, description, temperature, model_id, reasoning, active, role) "
        "SELECT 'Test Agent', 'Test', 0.7, id, 'medium', true, 'assistant' "
        "FROM models WHERE active = true LIMIT 1 RETURNING id"
    )

    # Create a prompt
    prompt_id = await db.fetchval(
        "INSERT INTO prompts(system_prompt) VALUES ('Dept Prompt') RETURNING id"
    )

    # Get a department
    dept_id = await db.fetchval("SELECT id FROM departments LIMIT 1")

    # Create department-specific prompt link
    await db.execute(
        "INSERT INTO agent_department_prompts(agent_id, department_id, prompt_id, active) "
        "VALUES ($1, $2, $3, true)",
        agent_id,
        dept_id,
        prompt_id,
    )

    response = await client.post(
        "/api/v3/agents/delete-prompt",
        json={
            "agentId": str(agent_id),
            "promptId": str(prompt_id),
            "departmentId": str(dept_id),
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True

    # Verify department-specific prompt link was deactivated
    dept_prompt_link = await db.fetchrow(
        "SELECT active FROM agent_department_prompts "
        "WHERE agent_id = $1 AND department_id = $2 AND prompt_id = $3",
        agent_id,
        dept_id,
        prompt_id,
    )
    assert dept_prompt_link is not None
    assert dept_prompt_link["active"] is False


async def test_delete_agent_prompt_last_default(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting the last default prompt (should succeed and deactivate it)."""
    await get_superadmin_alias(db)

    # Create an agent with only one prompt
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, description, temperature, model_id, reasoning, active, role) "
        "SELECT 'Test Agent', 'Test', 0.7, id, 'medium', true, 'assistant' "
        "FROM models WHERE active = true LIMIT 1 RETURNING id"
    )

    prompt_id = await db.fetchval(
        "INSERT INTO prompts(system_prompt) VALUES ('Only Prompt') RETURNING id"
    )

    await db.execute(
        "INSERT INTO agent_prompts(agent_id, prompt_id, active) VALUES ($1, $2, true)",
        agent_id,
        prompt_id,
    )

    response = await client.post(
        "/api/v3/agents/delete-prompt",
        json={
            "agentId": str(agent_id),
            "promptId": str(prompt_id),
            "departmentId": None,
        },
    )

    # Should succeed - it deactivates the prompt
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

    # Verify prompt was deactivated
    prompt_link = await db.fetchrow(
        "SELECT active FROM agent_prompts WHERE agent_id = $1 AND prompt_id = $2",
        agent_id,
        prompt_id,
    )
    assert prompt_link is not None
    assert prompt_link["active"] is False
