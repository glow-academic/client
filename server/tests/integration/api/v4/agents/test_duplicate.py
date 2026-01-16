"""Route tests for POST /api/v4/agents/duplicate endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestPromptSqlParams,
    CreateTestPromptSqlRow,
    GetAgentDepartmentLinkSqlParams,
    GetAgentDepartmentLinkSqlRow,
    GetAgentPromptLinkSqlParams,
    GetAgentPromptLinkSqlRow,
    GetFirstDepartmentSqlRow,
    GetFirstModelSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_duplicate_agent(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating an agent."""
    await get_superadmin_alias(db)

    # Create an agent with prompt and department links using SQL file
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
            name="Original Agent",
            description="Original Description",
            role="assistant",
            active=True,
        ),
    )
    typed_agent = CreateTestAgentSqlRow.model_validate(agent_result.model_dump())
    assert typed_agent.agent_id is not None
    agent_id = typed_agent.agent_id

    # Create a prompt and link it using SQL file
    prompt_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_create_test_prompt_v4_complete.sql",
        params=CreateTestPromptSqlParams(system_prompt="Original prompt"),
    )
    typed_prompt = CreateTestPromptSqlRow.model_validate(prompt_result.model_dump())
    assert typed_prompt.prompt_id is not None
    prompt_id = typed_prompt.prompt_id

    # Create agent prompt link using SQL file
    from tests.sql.types import (
        CreateAgentPromptLinkSqlParams,
    )

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_create_agent_prompt_link_v4_complete.sql",
        params=CreateAgentPromptLinkSqlParams(agent_id=agent_id, prompt_id=prompt_id),
    )

    # Link to a department using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # Link to department using SQL file
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
        "/api/v4/agents/duplicate",
        json={"agentId": str(agent_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "agentId" in data
    assert data["message"] == "Agent duplicated successfully"

    new_agent_id = data["agentId"]
    assert new_agent_id != str(agent_id)

    # Verify new agent was created with same properties using SQL files
    from tests.sql.types import GetAgentByIdSqlParams, GetAgentByIdSqlRow

    new_agent_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_agent_by_id_v4_complete.sql",
        params=GetAgentByIdSqlParams(agent_id=new_agent_id),
    )
    typed_new_agent = GetAgentByIdSqlRow.model_validate(new_agent_result.model_dump())

    original_agent_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_agent_by_id_v4_complete.sql",
        params=GetAgentByIdSqlParams(agent_id=agent_id),
    )
    typed_original_agent = GetAgentByIdSqlRow.model_validate(
        original_agent_result.model_dump()
    )

    assert typed_new_agent.agent_id is not None
    assert typed_new_agent.name == typed_original_agent.name + " Copy"
    assert typed_new_agent.description == typed_original_agent.description
    assert typed_new_agent.model_id == typed_original_agent.model_id
    assert typed_new_agent.role == typed_original_agent.role

    # Verify prompt was duplicated using SQL file
    new_prompt_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_agent_prompt_link_v4_complete.sql",
        params=GetAgentPromptLinkSqlParams(agent_id=new_agent_id),
    )
    typed_new_prompt_link = GetAgentPromptLinkSqlRow.model_validate(
        new_prompt_link_result.model_dump()
    )
    assert typed_new_prompt_link.prompt_id is not None

    # Verify department link was duplicated using SQL file
    new_dept_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_agent_department_link_v4_complete.sql",
        params=GetAgentDepartmentLinkSqlParams(
            agent_id=new_agent_id, department_id=dept_id
        ),
    )
    typed_new_dept_link = GetAgentDepartmentLinkSqlRow.model_validate(
        new_dept_link_result.model_dump()
    )
    assert typed_new_dept_link.department_id is not None
    assert typed_new_dept_link.active is True


async def test_duplicate_agent_without_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating an agent without department links (cross-department)."""
    await get_superadmin_alias(db)

    # Create an agent without department links using SQL file
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
            name="Cross-Dept Agent",
            description="Test",
            role="assistant",
            active=True,
        ),
    )
    typed_agent = CreateTestAgentSqlRow.model_validate(agent_result.model_dump())
    assert typed_agent.agent_id is not None
    agent_id = typed_agent.agent_id

    # Create a prompt and link it using SQL file
    prompt_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_create_test_prompt_v4_complete.sql",
        params=CreateTestPromptSqlParams(system_prompt="Test prompt"),
    )
    typed_prompt = CreateTestPromptSqlRow.model_validate(prompt_result.model_dump())
    assert typed_prompt.prompt_id is not None
    prompt_id = typed_prompt.prompt_id

    # Create agent prompt link using SQL file
    from tests.sql.types import (
        CreateAgentPromptLinkSqlParams,
    )

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_create_agent_prompt_link_v4_complete.sql",
        params=CreateAgentPromptLinkSqlParams(agent_id=agent_id, prompt_id=prompt_id),
    )

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/agents/duplicate",
        json={"agentId": str(agent_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    new_agent_id = data["agentId"]

    # Verify no department links were created (original had none) using SQL file
    from tests.sql.types import (
        GetAgentDepartmentLinksSqlParams,
        GetAgentDepartmentLinksSqlRow,
    )

    dept_links_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_agent_department_links_v4_complete.sql",
        params=GetAgentDepartmentLinksSqlParams(agent_id=new_agent_id),
    )
    typed_dept_links = GetAgentDepartmentLinksSqlRow.model_validate(
        dept_links_result.model_dump()
    )
    # If no links exist, the function returns NULL values
    assert typed_dept_links.department_id is None


async def test_duplicate_agent_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a non-existent agent."""
    await get_superadmin_alias(db)

    fake_agent_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/agents/duplicate",
        json={"agentId": fake_agent_id},
    )

    assert response.status_code == 500
    data = response.json()
    assert "detail" in data
