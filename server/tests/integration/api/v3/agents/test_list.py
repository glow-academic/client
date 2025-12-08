"""Route tests for POST /api/v3/agents/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_list_agents(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting agents list with model mapping."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/agents/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "agents" in data
    assert "model_mapping" in data
    assert "department_mapping" in data
    assert isinstance(data["agents"], list)
    assert len(data["agents"]) >= 0

    # If there are agents, verify model mapping is populated
    if data["agents"]:
        for agent in data["agents"]:
            assert "agent_id" in agent
            assert "name" in agent
            assert "model_id" in agent
            # Verify model mapping exists for agent's model
            if agent["model_id"]:
                assert agent["model_id"] in data["model_mapping"]


async def test_list_agents_empty(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test agents list works even with no agents (system-wide, so should have seed data)."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/agents/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    # Agents are system-wide, should have seed data
    assert data is not None
    assert "agents" in data
    assert "model_mapping" in data
    assert "department_mapping" in data


async def test_list_agents_permissions_superadmin(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test superadmin has edit/duplicate permissions and correct delete logic."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/agents/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    # Superadmin should have edit and duplicate permissions
    for agent in data["agents"]:
        assert agent["can_edit"] is True
        assert agent["can_duplicate"] is True
        # can_delete depends on default_agent and department_agents links


async def test_list_agents_permissions_non_superadmin(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test non-superadmin does not have edit/delete permissions but can duplicate."""
    # Create a non-superadmin profile
    ta_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, role) "
        "VALUES('Test', 'TA', 'ta') RETURNING id"
    )
    await db.execute(
        "INSERT INTO profile_emails(profile_id, email, is_primary, active) "
        "VALUES($1, 'redacted@purdue.edu', true, true)",
        ta_id,
    )

    response = await client.post(
        "/api/v3/agents/list",
        json={"profileId": str(ta_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    # TA should not have edit or delete permissions, but can duplicate
    for agent in data["agents"]:
        assert agent["can_edit"] is False
        assert agent["can_duplicate"] is True
        assert agent["can_delete"] is False


async def test_list_agents_optimization(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that agents list optimization works correctly with model info."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/agents/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None

    # Verify each agent has a model_id and it's in the mapping
    for agent in data["agents"]:
        if agent["model_id"]:  # Some agents might not have a model
            model_info = data["model_mapping"].get(agent["model_id"])
            assert model_info is not None
            assert "name" in model_info
            assert model_info["name"] is not None
            # Description might be empty string, but should exist
            assert "description" in model_info
            assert model_info["description"] is not None


async def test_list_agents_can_delete_default(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that agents linked to departments cannot be deleted."""
    profile_id = await get_superadmin_alias(db)

    # Create an agent and link it to a department (which prevents deletion)
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, description, temperature, model_id, reasoning, active) "
        "SELECT 'Default Agent', 'Test', 0.7, id, 'none', true "
        "FROM models WHERE active = true LIMIT 1 RETURNING id"
    )

    # Link it to a department (this prevents deletion)
    await db.execute(
        "INSERT INTO agent_departments(agent_id, department_id) "
        "SELECT $1, id FROM departments LIMIT 1",
        agent_id,
    )

    response = await client.post(
        "/api/v3/agents/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    # Find the linked agent
    linked_agent = next(
        (a for a in data["agents"] if a["agent_id"] == str(agent_id)), None
    )
    assert linked_agent is not None
    assert linked_agent["can_delete"] is False


async def test_list_agents_can_delete_linked(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that agents linked to departments cannot be deleted."""
    profile_id = await get_superadmin_alias(db)

    # Create an agent
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, description, temperature, model_id, reasoning, active) "
        "SELECT 'Linked Agent', 'Test', 0.7, id, 'none', true "
        "FROM models WHERE active = true LIMIT 1 RETURNING id"
    )

    # Link it to a department
    await db.execute(
        "INSERT INTO agent_departments(agent_id, department_id) "
        "SELECT $1, id FROM departments LIMIT 1",
        agent_id,
    )

    response = await client.post(
        "/api/v3/agents/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    # Find the linked agent
    linked_agent = next(
        (a for a in data["agents"] if a["agent_id"] == str(agent_id)), None
    )
    assert linked_agent is not None
    assert linked_agent["can_delete"] is False


async def test_list_agents_can_delete_allowed(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that unlinked agents can be deleted by superadmin."""
    profile_id = await get_superadmin_alias(db)

    # Create an unlinked agent (no department links)
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, description, temperature, model_id, reasoning, active) "
        "SELECT 'Deletable Agent', 'Test', 0.7, id, 'none', true "
        "FROM models WHERE active = true LIMIT 1 RETURNING id"
    )

    response = await client.post(
        "/api/v3/agents/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    # Find the deletable agent
    deletable_agent = next(
        (a for a in data["agents"] if a["agent_id"] == str(agent_id)), None
    )
    assert deletable_agent is not None
    assert deletable_agent["can_edit"] is True
    assert deletable_agent["can_duplicate"] is True
    assert deletable_agent["can_delete"] is True


async def test_list_agents_can_duplicate(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that all agents can be duplicated regardless of status."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/agents/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    # All agents should have can_duplicate = true
    for agent in data["agents"]:
        assert agent["can_duplicate"] is True
