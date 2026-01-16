"""Route tests for POST /api/v4/agents/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    GetFirstDepartmentSqlRow,
    GetFirstModelSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_delete_agent(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting an agent that is not in use."""
    await get_superadmin_alias(db)

    # Create an agent without any usage using SQL file
    model_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_first_model_v4_complete.sql",
        params=None,
    )
    typed_model = GetFirstModelSqlRow.model_validate(model_result.model_dump())
    assert typed_model.model_id is not None

    from tests.sql.types import CreateTestAgentSqlParams, CreateTestAgentSqlRow

    agent_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_create_test_agent_v4_complete.sql",
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

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/agents/delete",
        json={"agentId": str(agent_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Agent deleted successfully"

    # Verify agent was deleted using SQL file
    from tests.sql.types import GetAgentByIdSqlParams, GetAgentByIdSqlRow

    agent_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_agent_by_id_v4_complete.sql",
        params=GetAgentByIdSqlParams(agent_id=agent_id),
    )
    typed_agent = GetAgentByIdSqlRow.model_validate(agent_result.model_dump())
    assert typed_agent.agent_id is None


async def test_delete_agent_in_use(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that deleting an agent linked to departments fails."""
    await get_superadmin_alias(db)

    # Create an agent using SQL file
    model_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_first_model_v4_complete.sql",
        params=None,
    )
    typed_model = GetFirstModelSqlRow.model_validate(model_result.model_dump())
    assert typed_model.model_id is not None

    from tests.sql.types import CreateTestAgentSqlParams, CreateTestAgentSqlRow

    agent_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_create_test_agent_v4_complete.sql",
        params=CreateTestAgentSqlParams(
            model_id=typed_model.model_id,
            name="Used Agent",
            description="Test",
            role="assistant",
            active=True,
        ),
    )
    typed_agent = CreateTestAgentSqlRow.model_validate(agent_result.model_dump())
    assert typed_agent.agent_id is not None
    agent_id = typed_agent.agent_id

    # Link agent to a department (this makes it "in use") using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # Create agent department link using SQL file
    from tests.sql.types import (
        CreateAgentDepartmentLinkSqlParams,
    )

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_create_agent_department_link_v4_complete.sql",
        params=CreateAgentDepartmentLinkSqlParams(
            agent_id=agent_id, department_id=dept_id
        ),
    )

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/agents/delete",
        json={"agentId": str(agent_id)},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "in use" in data["detail"].lower()

    # Verify agent was not deleted using SQL file
    from tests.sql.types import GetAgentByIdSqlParams, GetAgentByIdSqlRow

    agent_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_agent_by_id_v4_complete.sql",
        params=GetAgentByIdSqlParams(agent_id=agent_id),
    )
    typed_agent = GetAgentByIdSqlRow.model_validate(agent_result.model_dump())
    assert typed_agent.agent_id is not None


async def test_delete_agent_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent agent."""
    await get_superadmin_alias(db)

    fake_agent_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/agents/delete",
        json={"agentId": fake_agent_id},
    )

    # Should succeed (no error from SQL DELETE on non-existent row)
    assert response.status_code == 200
