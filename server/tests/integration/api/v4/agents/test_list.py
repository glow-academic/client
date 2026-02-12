"""Route tests for POST /api/v4/artifacts/agents/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestProfileSqlParams,
    CreateTestProfileSqlRow,
    GetFirstDepartmentSqlRow,
    GetFirstModelSqlRow,
)

from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_list_agents(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting agents list with model and department info."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/artifacts/agents/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "agents" in data
    assert "models" in data
    assert "departments" in data
    assert "total_count" in data
    assert isinstance(data["agents"], list)
    assert len(data["agents"]) >= 0

    # If there are agents, verify model info is hydrated directly on agent
    if data["agents"]:
        for agent in data["agents"]:
            assert "agent_id" in agent
            assert "name" in agent
            assert "model_id" in agent
            if agent["model_id"]:
                assert "model_name" in agent


async def test_list_agents_empty(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test agents list works even with no agents (system-wide, so should have seed data)."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/artifacts/agents/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    # Agents are system-wide, should have seed data
    assert data is not None
    assert "agents" in data
    assert "models" in data
    assert "departments" in data
    assert "total_count" in data


async def test_list_agents_permissions_superadmin(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test superadmin has edit/duplicate permissions and correct delete logic."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/artifacts/agents/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    # Superadmin should have edit and duplicate permissions
    for agent in data["agents"]:
        assert agent["can_edit"] is True
        assert agent["can_duplicate"] is True
        # can_delete depends on department_link_count


async def test_list_agents_permissions_non_superadmin(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test non-superadmin does not have edit/delete/duplicate permissions."""
    # Create a non-superadmin profile using SQL file
    profile_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_test_profile_v4_complete.sql",
        params=CreateTestProfileSqlParams(
            first_name="Test",
            last_name="Member",
            role="member",
            email="redacted@purdue.edu",
        ),
    )
    typed_profile = CreateTestProfileSqlRow.model_validate(profile_result.model_dump())
    assert typed_profile.profile_id is not None
    ta_id = typed_profile.profile_id

    # v4 routes get profile_id from router dependency (header), not request body
    # For this test, we need to set the profile header
    response = await client.post(
        "/api/v4/artifacts/agents/list",
        json={},
        headers={"X-Profile-Id": str(ta_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    # Member should not have edit, delete, or duplicate permissions
    for agent in data["agents"]:
        assert agent["can_edit"] is False
        assert agent["can_duplicate"] is False
        assert agent["can_delete"] is False


async def test_list_agents_optimization(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that agents list optimization works correctly with model info."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/artifacts/agents/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None

    # Verify each agent has model info hydrated directly
    for agent in data["agents"]:
        if agent["model_id"]:
            assert agent["model_name"] is not None
            # Description might be empty string, but should exist
            assert "model_description" in agent


async def test_list_agents_can_delete_default(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that agents linked to departments cannot be deleted."""
    await get_superadmin_alias(db)

    # Create an agent and link it to a department (which prevents deletion) using SQL files
    model_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_first_model_v4_complete.sql",
        params=None,
    )
    typed_model = GetFirstModelSqlRow.model_validate(model_result.model_dump())
    assert typed_model.model_id is not None

    from tests.sql.types import CreateTestAgentSqlParams, CreateTestAgentSqlRow

    agent_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_test_agent_v4_complete.sql",
        params=CreateTestAgentSqlParams(
            model_id=typed_model.model_id,
            name="Default Agent",
            description="Test",
            role="assistant",
            active=True,
        ),
    )
    typed_agent = CreateTestAgentSqlRow.model_validate(agent_result.model_dump())
    assert typed_agent.agent_id is not None
    agent_id = typed_agent.agent_id

    # Link it to a department (this prevents deletion) using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None

    from tests.sql.types import (
        CreateAgentDepartmentLinkSqlParams,
    )

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_agent_department_link_v4_complete.sql",
        params=CreateAgentDepartmentLinkSqlParams(
            agent_id=agent_id, department_id=typed_dept.department_id
        ),
    )

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/artifacts/agents/list",
        json={},
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
    await get_superadmin_alias(db)

    # Create an agent using SQL file
    from tests.sql.types import (
        CreateTestAgentSqlParams,
        CreateTestAgentSqlRow,
        GetFirstDepartmentSqlRow,
        GetFirstModelSqlRow,
    )

    model_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_first_model_v4_complete.sql",
        params=None,
    )
    typed_model = GetFirstModelSqlRow.model_validate(model_result.model_dump())
    assert typed_model.model_id is not None

    agent_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_test_agent_v4_complete.sql",
        params=CreateTestAgentSqlParams(
            model_id=typed_model.model_id,
            name="Linked Agent",
            description="Test",
            role="assistant",
            active=True,
        ),
    )
    typed_agent = CreateTestAgentSqlRow.model_validate(agent_result.model_dump())
    assert typed_agent.agent_id is not None
    agent_id = typed_agent.agent_id

    # Link it to a department using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None

    from tests.sql.types import (
        CreateAgentDepartmentLinkSqlParams,
    )

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_agent_department_link_v4_complete.sql",
        params=CreateAgentDepartmentLinkSqlParams(
            agent_id=agent_id, department_id=typed_dept.department_id
        ),
    )

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/artifacts/agents/list",
        json={},
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
    await get_superadmin_alias(db)

    # Create an unlinked agent (no department links) using SQL file
    from tests.sql.types import (
        CreateTestAgentSqlParams,
        CreateTestAgentSqlRow,
        GetFirstModelSqlRow,
    )

    model_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_first_model_v4_complete.sql",
        params=None,
    )
    typed_model = GetFirstModelSqlRow.model_validate(model_result.model_dump())
    assert typed_model.model_id is not None

    agent_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_test_agent_v4_complete.sql",
        params=CreateTestAgentSqlParams(
            model_id=typed_model.model_id,
            name="Deletable Agent",
            description="Test",
            role="assistant",
            active=True,
        ),
    )
    typed_agent = CreateTestAgentSqlRow.model_validate(agent_result.model_dump())
    assert typed_agent.agent_id is not None
    agent_id = typed_agent.agent_id

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/artifacts/agents/list",
        json={},
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
    """Test that superadmin agents can be duplicated."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/artifacts/agents/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    # Superadmin should have can_duplicate = true for all agents
    for agent in data["agents"]:
        assert agent["can_duplicate"] is True
