"""Route tests for POST /api/v4/agents/create endpoint."""

import uuid
from uuid import UUID

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
    GetFirstDepartmentSqlParams,
    GetFirstDepartmentSqlRow,
    GetFirstModelSqlParams,
    GetFirstModelSqlRow,
)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_create_agent(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new agent with all fields."""
    await get_superadmin_alias(db)

    # Get a model ID for the agent using SQL file
    model_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_first_model_v4_complete.sql",
        params=None,
    )
    typed_model = GetFirstModelSqlRow.model_validate(model_result.model_dump())
    assert typed_model.model_id is not None
    model_id = typed_model.model_id

    # Get a department ID using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    response = await client.post(
        "/api/v4/agents/create",
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

    # Verify agent was created in database using SQL file
    from tests.sql.types import GetAgentByIdSqlParams, GetAgentByIdSqlRow

    agent_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_agent_by_id_v4_complete.sql",
        params=GetAgentByIdSqlParams(agent_id=UUID(data["agentId"])),
    )
    typed_agent = GetAgentByIdSqlRow.model_validate(agent_result.model_dump())
    assert typed_agent.agent_id is not None
    assert typed_agent.name == "Test Agent"
    assert typed_agent.description == "Test Description"
    assert typed_agent.model_id == model_id
    assert typed_agent.active is True
    assert typed_agent.role == "assistant"

    # Verify prompt was created and linked using SQL file
    prompt_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_agent_prompt_link_v4_complete.sql",
        params=GetAgentPromptLinkSqlParams(agent_id=UUID(data["agentId"])),
    )
    typed_prompt_link = GetAgentPromptLinkSqlRow.model_validate(
        prompt_link_result.model_dump()
    )
    assert typed_prompt_link.prompt_id is not None

    # Verify department link was created using SQL file
    dept_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_agent_department_link_v4_complete.sql",
        params=GetAgentDepartmentLinkSqlParams(
            agent_id=UUID(data["agentId"]), department_id=dept_id
        ),
    )
    typed_dept_link = GetAgentDepartmentLinkSqlRow.model_validate(
        dept_link_result.model_dump()
    )
    assert typed_dept_link.department_id is not None


async def test_create_agent_with_existing_prompt(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating an agent with an existing prompt_id."""
    await get_superadmin_alias(db)

    # Create a prompt first using SQL file
    prompt_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_create_test_prompt_v4_complete.sql",
        params=CreateTestPromptSqlParams(system_prompt="Existing prompt"),
    )
    typed_prompt = CreateTestPromptSqlRow.model_validate(prompt_result.model_dump())
    assert typed_prompt.prompt_id is not None
    prompt_id = typed_prompt.prompt_id

    # Get model ID using SQL file
    model_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_first_model_v4_complete.sql",
        params=None,
    )
    typed_model = GetFirstModelSqlRow.model_validate(model_result.model_dump())
    assert typed_model.model_id is not None
    model_id = typed_model.model_id

    response = await client.post(
        "/api/v4/agents/create",
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

    # Verify prompt link uses existing prompt using SQL file
    prompt_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_agent_prompt_link_v4_complete.sql",
        params=GetAgentPromptLinkSqlParams(agent_id=UUID(data["agentId"])),
    )
    typed_prompt_link = GetAgentPromptLinkSqlRow.model_validate(
        prompt_link_result.model_dump()
    )
    assert typed_prompt_link.prompt_id is not None
    assert typed_prompt_link.prompt_id == prompt_id


async def test_create_agent_without_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating an agent without department links (cross-department)."""
    await get_superadmin_alias(db)

    # Get model ID using SQL file
    model_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_first_model_v4_complete.sql",
        params=None,
    )
    typed_model = GetFirstModelSqlRow.model_validate(model_result.model_dump())
    assert typed_model.model_id is not None
    model_id = typed_model.model_id

    response = await client.post(
        "/api/v4/agents/create",
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

    # Verify no department links were created using SQL file
    from tests.sql.types import (
        GetAgentDepartmentLinksSqlParams,
        GetAgentDepartmentLinksSqlRow,
    )

    dept_links_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_agent_department_links_v4_complete.sql",
        params=GetAgentDepartmentLinksSqlParams(agent_id=UUID(data["agentId"])),
    )
    # The result should be empty or None if no links exist
    # Since execute_sql_typed returns a single row, we need to check if it's None or empty
    typed_dept_links = GetAgentDepartmentLinksSqlRow.model_validate(
        dept_links_result.model_dump()
    )
    # If no links exist, the function returns NULL values
    assert typed_dept_links.department_id is None


async def test_create_agent_invalid_model(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating an agent with invalid model_id."""
    await get_superadmin_alias(db)

    fake_model_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v4/agents/create",
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
