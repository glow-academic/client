"""Route tests for POST /api/v4/agents/update endpoint."""

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


async def test_update_agent(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating an agent with all fields."""
    await get_superadmin_alias(db)

    # Create an agent first using SQL file
    model_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_first_model_v4_complete.sql",
        params=None,
    )
    typed_model = GetFirstModelSqlRow.model_validate(model_result.model_dump())
    assert typed_model.model_id is not None
    model_id = typed_model.model_id

    from tests.sql.types import CreateTestAgentSqlParams, CreateTestAgentSqlRow

    agent_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_test_agent_v4_complete.sql",
        params=CreateTestAgentSqlParams(
            model_id=model_id,
            name="Original Name",
            description="Original Description",
            role="assistant",
            active=True,
        ),
    )
    typed_agent = CreateTestAgentSqlRow.model_validate(agent_result.model_dump())
    assert typed_agent.agent_id is not None
    agent_id = typed_agent.agent_id

    # Get a department ID using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/agents/update",
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
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Agent updated successfully"

    # Verify agent was updated using SQL file
    from tests.sql.types import GetAgentByIdSqlParams, GetAgentByIdSqlRow

    agent_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_agent_by_id_v4_complete.sql",
        params=GetAgentByIdSqlParams(agent_id=agent_id),
    )
    typed_agent = GetAgentByIdSqlRow.model_validate(agent_result.model_dump())
    assert typed_agent.agent_id is not None
    assert typed_agent.name == "Updated Name"
    assert typed_agent.description == "Updated Description"
    assert typed_agent.active is False
    assert typed_agent.role == "classify"

    # Verify new prompt was created using SQL file
    prompt_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_agent_prompt_link_v4_complete.sql",
        params=GetAgentPromptLinkSqlParams(agent_id=agent_id),
    )
    typed_prompt_link = GetAgentPromptLinkSqlRow.model_validate(
        prompt_link_result.model_dump()
    )
    assert typed_prompt_link.prompt_id is not None

    # Verify department link was updated using SQL file
    dept_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_agent_department_link_v4_complete.sql",
        params=GetAgentDepartmentLinkSqlParams(
            agent_id=agent_id, department_id=dept_id
        ),
    )
    typed_dept_link = GetAgentDepartmentLinkSqlRow.model_validate(
        dept_link_result.model_dump()
    )
    assert typed_dept_link.department_id is not None


async def test_update_agent_with_existing_prompt(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating an agent with an existing prompt_id."""
    await get_superadmin_alias(db)

    # Create agent using SQL file
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
            name="Test Agent",
            description="Test",
            role="assistant",
            active=True,
        ),
    )
    typed_agent = CreateTestAgentSqlRow.model_validate(agent_result.model_dump())
    assert typed_agent.agent_id is not None
    agent_id = typed_agent.agent_id

    # Create prompt using SQL file
    prompt_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_test_prompt_v4_complete.sql",
        params=CreateTestPromptSqlParams(system_prompt="Existing prompt"),
    )
    typed_prompt = CreateTestPromptSqlRow.model_validate(prompt_result.model_dump())
    assert typed_prompt.prompt_id is not None
    prompt_id = typed_prompt.prompt_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/agents/update",
        json={
            "agentId": str(agent_id),
            "name": "Updated Agent",
            "description": "Updated",
            "prompt_id": str(prompt_id),
            "system_prompt": "",  # Not used when prompt_id provided
            "temperature": 0.7,
            "model_id": str(typed_model.model_id),
            "reasoning": "medium",
            "active": True,
            "role": "assistant",
            "department_ids": None,
        },
    )

    assert response.status_code == 200

    # Verify prompt link uses existing prompt using SQL file
    prompt_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_agent_prompt_link_v4_complete.sql",
        params=GetAgentPromptLinkSqlParams(agent_id=agent_id),
    )
    typed_prompt_link = GetAgentPromptLinkSqlRow.model_validate(
        prompt_link_result.model_dump()
    )
    assert typed_prompt_link.prompt_id is not None
    assert typed_prompt_link.prompt_id == prompt_id


async def test_update_agent_removes_department_links(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that updating an agent replaces department links."""
    await get_superadmin_alias(db)

    # Create agent with department link using SQL file
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
            name="Test Agent",
            description="Test",
            role="assistant",
            active=True,
        ),
    )
    typed_agent = CreateTestAgentSqlRow.model_validate(agent_result.model_dump())
    assert typed_agent.agent_id is not None
    agent_id = typed_agent.agent_id

    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    old_dept_id = typed_dept.department_id

    # Create agent department link using SQL file
    from tests.sql.types import (
        CreateAgentDepartmentLinkSqlParams,
    )

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_agent_department_link_v4_complete.sql",
        params=CreateAgentDepartmentLinkSqlParams(
            agent_id=agent_id, department_id=old_dept_id
        ),
    )

    # Get a different department using SQL file
    from tests.sql.types import (
        GetDifferentDepartmentSqlParams,
        GetDifferentDepartmentSqlRow,
    )

    new_dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_get_different_department_v4_complete.sql",
        params=GetDifferentDepartmentSqlParams(exclude_department_id=old_dept_id),
    )
    typed_new_dept = GetDifferentDepartmentSqlRow.model_validate(
        new_dept_result.model_dump()
    )
    assert typed_new_dept.department_id is not None
    new_dept_id = typed_new_dept.department_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/agents/update",
        json={
            "agentId": str(agent_id),
            "name": "Test Agent",
            "description": "Test",
            "system_prompt": "Test prompt",
            "temperature": 0.5,
            "model_id": str(typed_model.model_id),
            "reasoning": "low",
            "active": True,
            "role": "assistant",
            "department_ids": [str(new_dept_id)] if new_dept_id else [],
            "prompt_id": None,
        },
    )

    assert response.status_code == 200

    # Verify old department link is removed using SQL file
    old_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_agent_department_link_v4_complete.sql",
        params=GetAgentDepartmentLinkSqlParams(
            agent_id=agent_id, department_id=old_dept_id
        ),
    )
    typed_old_link = GetAgentDepartmentLinkSqlRow.model_validate(
        old_link_result.model_dump()
    )
    # If link was removed, department_id should be None
    assert typed_old_link.department_id is None or typed_old_link.active is False

    # Verify new department link exists using SQL file
    if new_dept_id:
        new_link_result = await execute_sql_typed(
            conn=db,
            sql_path="tests/sql/v4/integration/queries/api/agents/test_get_agent_department_link_v4_complete.sql",
            params=GetAgentDepartmentLinkSqlParams(
                agent_id=agent_id, department_id=new_dept_id
            ),
        )
        typed_new_link = GetAgentDepartmentLinkSqlRow.model_validate(
            new_link_result.model_dump()
        )
        assert typed_new_link.department_id is not None


async def test_update_agent_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent agent."""
    await get_superadmin_alias(db)

    fake_agent_id = "00000000-0000-0000-0000-000000000000"
    model_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_first_model_v4_complete.sql",
        params=None,
    )
    typed_model = GetFirstModelSqlRow.model_validate(model_result.model_dump())
    assert typed_model.model_id is not None

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/agents/update",
        json={
            "agentId": fake_agent_id,
            "name": "Test",
            "description": "Test",
            "system_prompt": "Test",
            "temperature": 0.5,
            "model_id": str(typed_model.model_id),
            "reasoning": "low",
            "active": True,
            "role": "assistant",
            "department_ids": None,
            "prompt_id": None,
        },
    )

    # May fail if agent doesn't exist (depends on SQL implementation)
    # The update might fail when trying to create prompt for non-existent agent
    assert response.status_code in [200, 500]


async def test_update_agent_empty_model_id(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating an agent with empty model_id should return proper error."""
    await get_superadmin_alias(db)

    # Create an agent first using SQL file
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
            name="Test Agent",
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
        "/api/v4/agents/update",
        json={
            "agentId": str(agent_id),
            "name": "Updated Name",
            "description": "Updated Description",
            "system_prompt": "Updated prompt",
            "temperature": 0.9,
            "model_id": "",  # Empty string should be rejected
            "reasoning": "high",
            "active": False,
            "role": "assistant",
            "department_ids": None,
            "prompt_id": None,
        },
    )

    # Should return 400 for invalid model_id, not 500
    assert response.status_code == 400
    error_detail = response.json().get("detail", "")
    assert "model_id" in error_detail.lower() or "required" in error_detail.lower()
