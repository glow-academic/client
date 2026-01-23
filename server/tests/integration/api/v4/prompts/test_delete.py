"""Route tests for POST /api/v4/prompts/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateAgentDepartmentPromptLinkSqlParams,
    CreateAgentPromptLinkInactiveSqlParams,
    CreateAgentPromptLinkSqlParams,
    CreatePersonaDepartmentPromptLinkSqlParams,
    CreatePersonaPromptLinkSqlParams,
    CreateTestAgentSqlParams,
    CreateTestAgentSqlRow,
    CreateTestPersonaSqlParams,
    CreateTestPersonaSqlRow,
    CreateTestPromptSqlParams,
    CreateTestPromptSqlRow,
    GetAgentDepartmentPromptLinkStatusSqlParams,
    GetAgentDepartmentPromptLinkStatusSqlRow,
    GetAgentPromptLinkStatusSqlParams,
    GetAgentPromptLinkStatusSqlRow,
    GetFirstDepartmentSqlRow,
    GetPersonaDepartmentPromptLinkStatusSqlParams,
    GetPersonaDepartmentPromptLinkStatusSqlRow,
    GetPersonaPromptLinkStatusSqlParams,
    GetPersonaPromptLinkStatusSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_delete_agent_prompt_default(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a default agent prompt (when multiple prompts exist)."""
    await get_superadmin_alias(db)

    # Create an agent using SQL file
    model_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_first_model_v4_complete.sql",
        params=None,
    )
    from tests.sql.types import GetFirstModelSqlRow

    typed_model = GetFirstModelSqlRow.model_validate(model_result.model_dump())
    assert typed_model.model_id is not None

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

    # Create two prompts using SQL files
    prompt1_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_test_prompt_v4_complete.sql",
        params=CreateTestPromptSqlParams(system_prompt="Prompt 1"),
    )
    typed_prompt1 = CreateTestPromptSqlRow.model_validate(prompt1_result.model_dump())
    assert typed_prompt1.prompt_id is not None
    prompt1_id = typed_prompt1.prompt_id

    prompt2_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_test_prompt_v4_complete.sql",
        params=CreateTestPromptSqlParams(system_prompt="Prompt 2"),
    )
    typed_prompt2 = CreateTestPromptSqlRow.model_validate(prompt2_result.model_dump())
    assert typed_prompt2.prompt_id is not None
    prompt2_id = typed_prompt2.prompt_id

    # Link first prompt as active using SQL file
    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_agent_prompt_link_v4_complete.sql",
        params=CreateAgentPromptLinkSqlParams(agent_id=agent_id, prompt_id=prompt1_id),
    )

    # Link second prompt as inactive using SQL file
    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_agent_prompt_link_inactive_v4_complete.sql",
        params=CreateAgentPromptLinkInactiveSqlParams(
            agent_id=agent_id, prompt_id=prompt2_id
        ),
    )

    # v4 routes get profile_id from router dependency
    # Note: API uses snake_case field names
    response = await client.post(
        "/api/v4/prompts/delete",
        json={
            "agent_id": str(agent_id),
            "prompt_id": str(prompt1_id),
            "department_id": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Prompt deleted successfully"

    # Verify prompt link was deactivated using SQL file
    link_status_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_agent_prompt_link_status_v4_complete.sql",
        params=GetAgentPromptLinkStatusSqlParams(
            agent_id=agent_id, prompt_id=prompt1_id
        ),
    )
    typed_status = GetAgentPromptLinkStatusSqlRow.model_validate(
        link_status_result.model_dump()
    )
    assert typed_status.active is False


async def test_delete_agent_prompt_department_specific(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a department-specific agent prompt."""
    await get_superadmin_alias(db)

    # Create an agent using SQL file
    model_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_first_model_v4_complete.sql",
        params=None,
    )
    from tests.sql.types import GetFirstModelSqlRow

    typed_model = GetFirstModelSqlRow.model_validate(model_result.model_dump())
    assert typed_model.model_id is not None

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

    # Create a prompt using SQL file
    prompt_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_test_prompt_v4_complete.sql",
        params=CreateTestPromptSqlParams(system_prompt="Dept Prompt"),
    )
    typed_prompt = CreateTestPromptSqlRow.model_validate(prompt_result.model_dump())
    assert typed_prompt.prompt_id is not None
    prompt_id = typed_prompt.prompt_id

    # Get a department using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # Create department-specific prompt link using SQL file
    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_agent_department_prompt_link_v4_complete.sql",
        params=CreateAgentDepartmentPromptLinkSqlParams(
            agent_id=agent_id, department_id=dept_id, prompt_id=prompt_id
        ),
    )

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/prompts/delete",
        json={
            "agentId": str(agent_id),
            "promptId": str(prompt_id),
            "departmentId": str(dept_id),
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True

    # Verify department-specific prompt link was deactivated using SQL file
    dept_link_status_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_agent_department_prompt_link_status_v4_complete.sql",
        params=GetAgentDepartmentPromptLinkStatusSqlParams(
            agent_id=agent_id, department_id=dept_id, prompt_id=prompt_id
        ),
    )
    typed_dept_status = GetAgentDepartmentPromptLinkStatusSqlRow.model_validate(
        dept_link_status_result.model_dump()
    )
    assert typed_dept_status.active is False


async def test_delete_agent_prompt_last_default(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting the last default prompt (should succeed and deactivate it)."""
    await get_superadmin_alias(db)

    # Create an agent using SQL file
    model_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_first_model_v4_complete.sql",
        params=None,
    )
    from tests.sql.types import GetFirstModelSqlRow

    typed_model = GetFirstModelSqlRow.model_validate(model_result.model_dump())
    assert typed_model.model_id is not None

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

    # Create a prompt using SQL file
    prompt_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_test_prompt_v4_complete.sql",
        params=CreateTestPromptSqlParams(system_prompt="Only Prompt"),
    )
    typed_prompt = CreateTestPromptSqlRow.model_validate(prompt_result.model_dump())
    assert typed_prompt.prompt_id is not None
    prompt_id = typed_prompt.prompt_id

    # Link prompt using SQL file
    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_agent_prompt_link_v4_complete.sql",
        params=CreateAgentPromptLinkSqlParams(agent_id=agent_id, prompt_id=prompt_id),
    )

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/prompts/delete",
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

    # Verify prompt was deactivated using SQL file
    link_status_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_agent_prompt_link_status_v4_complete.sql",
        params=GetAgentPromptLinkStatusSqlParams(
            agent_id=agent_id, prompt_id=prompt_id
        ),
    )
    typed_status = GetAgentPromptLinkStatusSqlRow.model_validate(
        link_status_result.model_dump()
    )
    assert typed_status.active is False


async def test_delete_persona_prompt_default(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a default persona prompt."""
    await get_superadmin_alias(db)

    # Create a persona using SQL file
    persona_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/personas/test_create_test_persona_v4_complete.sql",
        params=CreateTestPersonaSqlParams(
            persona_name="Test Persona",
            description="Description",
            color="#3B82F6",
            icon="Brain",
            active=True,
        ),
    )
    typed_persona = CreateTestPersonaSqlRow.model_validate(persona_result.model_dump())
    assert typed_persona.persona_id is not None
    persona_id = typed_persona.persona_id

    # Create a prompt and link it as default using SQL file
    prompt_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_test_prompt_v4_complete.sql",
        params=CreateTestPromptSqlParams(system_prompt="Test prompt"),
    )
    typed_prompt = CreateTestPromptSqlRow.model_validate(prompt_result.model_dump())
    assert typed_prompt.prompt_id is not None
    prompt_id = typed_prompt.prompt_id

    # Link prompt to persona using SQL file
    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/personas/test_create_persona_prompt_link_v4_complete.sql",
        params=CreatePersonaPromptLinkSqlParams(
            persona_id=persona_id, prompt_id=prompt_id
        ),
    )

    # v4 routes get profile_id from router dependency
    # Note: v4 API uses agent_id field for both agents and personas
    response = await client.post(
        "/api/v4/prompts/delete",
        json={
            "agent_id": str(persona_id),
            "prompt_id": str(prompt_id),
            "department_id": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Prompt deleted successfully"

    # Verify prompt link was deactivated using SQL file
    link_status_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/personas/test_get_persona_prompt_link_status_v4_complete.sql",
        params=GetPersonaPromptLinkStatusSqlParams(
            persona_id=persona_id, prompt_id=prompt_id
        ),
    )
    typed_status = GetPersonaPromptLinkStatusSqlRow.model_validate(
        link_status_result.model_dump()
    )
    assert typed_status.link_exists is False


async def test_delete_persona_prompt_department(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a department-specific persona prompt."""
    await get_superadmin_alias(db)

    # Create a persona using SQL file
    persona_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/personas/test_create_test_persona_v4_complete.sql",
        params=CreateTestPersonaSqlParams(
            persona_name="Test Persona",
            description="Description",
            color="#3B82F6",
            icon="Brain",
            active=True,
        ),
    )
    typed_persona = CreateTestPersonaSqlRow.model_validate(persona_result.model_dump())
    assert typed_persona.persona_id is not None
    persona_id = typed_persona.persona_id

    # Create a prompt using SQL file
    prompt_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_test_prompt_v4_complete.sql",
        params=CreateTestPromptSqlParams(system_prompt="Dept prompt"),
    )
    typed_prompt = CreateTestPromptSqlRow.model_validate(prompt_result.model_dump())
    assert typed_prompt.prompt_id is not None
    prompt_id = typed_prompt.prompt_id

    # Get department using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # Link prompt as department-specific using SQL file
    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/personas/test_create_persona_department_prompt_link_v4_complete.sql",
        params=CreatePersonaDepartmentPromptLinkSqlParams(
            persona_id=persona_id, department_id=dept_id, prompt_id=prompt_id
        ),
    )

    # v4 routes get profile_id from router dependency
    # Note: v4 API uses agent_id field for both agents and personas
    response = await client.post(
        "/api/v4/prompts/delete",
        json={
            "agent_id": str(persona_id),
            "prompt_id": str(prompt_id),
            "department_id": str(dept_id),
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True

    # Verify department prompt link was deactivated using SQL file
    dept_link_status_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/personas/test_get_persona_department_prompt_link_status_v4_complete.sql",
        params=GetPersonaDepartmentPromptLinkStatusSqlParams(
            persona_id=persona_id, department_id=dept_id, prompt_id=prompt_id
        ),
    )
    typed_dept_status = GetPersonaDepartmentPromptLinkStatusSqlRow.model_validate(
        dept_link_status_result.model_dump()
    )
    assert typed_dept_status.link_exists is False
