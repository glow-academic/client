"""Route tests for POST /api/v4/personas/duplicate endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreatePersonaDepartmentLinkV4SqlParams,
    CreatePersonaPromptLinkV4SqlParams,
    CreateTestPersonaSqlParams,
    CreateTestPersonaSqlRow,
    CreateTestPromptSqlParams,
    CreateTestPromptSqlRow,
    GetFirstDepartmentSqlRow,
    GetPersonaByIdSqlParams,
    GetPersonaByIdSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_duplicate_persona(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a persona."""
    await get_superadmin_alias(db)

    # Create a persona using SQL file
    persona_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/personas/test_create_test_persona_v4_complete.sql",
        params=CreateTestPersonaSqlParams(
            persona_name="Original Persona",
            description="Original Description",
            color="#3B82F6",
            icon="Brain",
            active=True,
        ),
    )
    typed_persona = CreateTestPersonaSqlRow.model_validate(persona_result.model_dump())
    assert typed_persona.persona_id is not None
    persona_id = typed_persona.persona_id

    # Get department ID using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # Link persona to department using SQL file

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/personas/test_create_persona_department_link_v4_complete.sql",
        params=CreatePersonaDepartmentLinkV4SqlParams(
            input_persona_id=persona_id,
            input_department_id=dept_id,
        ),
    )

    # Create a prompt and link it using SQL file
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
        params=CreatePersonaPromptLinkV4SqlParams(
            input_persona_id=persona_id,
            input_prompt_id=prompt_id,
        ),
    )

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/personas/duplicate",
        json={"personaId": str(persona_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "personaId" in data
    assert data["personaId"] != str(persona_id)  # Should be a new ID
    assert data["message"] == "Persona 'Original Persona' duplicated successfully"

    # Verify duplicated persona exists using SQL file
    duplicated_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/personas/test_get_persona_by_id_v4_complete.sql",
        params=GetPersonaByIdSqlParams(persona_id=UUID(data["personaId"])),
    )
    typed_duplicated = GetPersonaByIdSqlRow.model_validate(
        duplicated_result.model_dump()
    )
    assert typed_duplicated.persona_id is not None
    assert typed_duplicated.name == "Original Persona Copy"  # SQL adds " Copy"
    assert typed_duplicated.description == "Original Description"


async def test_duplicate_persona_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a non-existent persona."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/personas/duplicate",
        json={"personaId": "00000000-0000-0000-0000-000000000000"},
    )

    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()
