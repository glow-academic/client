"""Route tests for POST /api/v3/agents/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_delete_agent(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting an agent that is not in use."""
    profile_id = await get_superadmin_alias(db)

    # Create an agent without any usage
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, description, temperature, model_id, reasoning, active, role) "
        "SELECT 'Deletable Agent', 'Test', 0.7, id, 'medium', true, 'assistant' "
        "FROM models WHERE active = true LIMIT 1 RETURNING id"
    )

    response = await client.post(
        "/api/v3/agents/delete",
        json={"agentId": str(agent_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Agent deleted successfully"

    # Verify agent was deleted
    agent = await db.fetchrow("SELECT * FROM agents WHERE id = $1", agent_id)
    assert agent is None


async def test_delete_agent_in_use(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that deleting an agent linked to departments fails."""
    profile_id = await get_superadmin_alias(db)

    # Create an agent
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, description, temperature, model_id, reasoning, active, role) "
        "SELECT 'Used Agent', 'Test', 0.7, id, 'medium', true, 'assistant' "
        "FROM models WHERE active = true LIMIT 1 RETURNING id"
    )

    # Link agent to a department (this makes it "in use")
    dept_id = await db.fetchval("SELECT id FROM departments LIMIT 1")
    await db.execute(
        "INSERT INTO agent_departments(agent_id, department_id) VALUES ($1, $2)",
        agent_id,
        dept_id,
    )

    response = await client.post(
        "/api/v3/agents/delete",
        json={"agentId": str(agent_id)},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "in use" in data["detail"].lower()

    # Verify agent was not deleted
    agent = await db.fetchrow("SELECT * FROM agents WHERE id = $1", agent_id)
    assert agent is not None


async def test_delete_agent_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent agent."""
    profile_id = await get_superadmin_alias(db)

    fake_agent_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/agents/delete",
        json={"agentId": fake_agent_id},
    )

    # Should succeed (no error from SQL DELETE on non-existent row)
    assert response.status_code == 200
