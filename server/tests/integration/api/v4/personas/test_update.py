"""Route tests for POST /api/v4/personas/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestPersonaSqlParams,
    CreateTestPersonaSqlRow,
    GetFirstDepartmentSqlRow,
    GetPersonaByIdSqlParams,
    GetPersonaByIdSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_update_persona(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a persona."""
    await get_superadmin_alias(db)

    # Create a persona using SQL file
    persona_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/personas/test_create_test_persona_v4_complete.sql",
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
        sql_path="tests/sql/v4/integration/api/departments/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/personas/update",
        json={
            "personaId": str(persona_id),
            "name": "Updated Persona",
            "description": "Updated Description",
            "department_ids": [str(dept_id)],
            "active": False,
            "color": "#EF4444",
            "icon": "User",
            "instructions": "Updated instructions",
            "example_ids": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Persona 'Updated Persona' updated successfully"

    # Verify persona was updated using SQL file
    persona_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/personas/test_get_persona_by_id_v4_complete.sql",
        params=GetPersonaByIdSqlParams(persona_id=persona_id),
    )
    typed_persona = GetPersonaByIdSqlRow.model_validate(persona_result.model_dump())
    assert typed_persona.persona_id is not None
    assert typed_persona.name == "Updated Persona"
    assert typed_persona.description == "Updated Description"
    assert typed_persona.active is False


async def test_update_persona_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent persona."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/personas/update",
        json={
            "personaId": "00000000-0000-0000-0000-000000000000",
            "name": "Updated Persona",
            "description": "",
            "department_ids": [],
            "active": True,
            "color": "#3B82F6",
            "icon": "Brain",
            "instructions": "",
            "example_ids": [],
        },
    )

    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()
