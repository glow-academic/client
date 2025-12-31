"""Route tests for POST /api/v4/personas/create endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    GetPersonaByIdSqlParams,
    GetPersonaByIdSqlRow,
    GetFirstDepartmentSqlParams,
    GetFirstDepartmentSqlRow,
)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_create_persona_minimal(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a persona with minimal fields."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/personas/create",
        json={
            "name": "New Persona",
            "description": "",
            "department_ids": [],
            "active": True,
            "color": "#3B82F6",
            "icon": "Brain",
            "instructions": None,
            "example_ids": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "personaId" in data
    assert data["message"] == "Persona 'New Persona' created successfully"

    # Verify persona was created using SQL file
    persona_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/personas/test_get_persona_by_id_v4_complete.sql",
        params=GetPersonaByIdSqlParams(persona_id=UUID(data["personaId"])),
    )
    typed_persona = GetPersonaByIdSqlRow.model_validate(persona_result.model_dump())
    assert typed_persona.persona_id is not None
    assert typed_persona.name == "New Persona"
    assert typed_persona.active is True


async def test_create_persona_with_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a persona with department links."""
    await get_superadmin_alias(db)

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
        "/api/v4/personas/create",
        json={
            "name": "Department Persona",
            "description": "Test Description",
            "department_ids": [str(dept_id)],
            "active": True,
            "color": "#EF4444",
            "icon": "User",
            "instructions": "Test instructions",
            "example_ids": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True

    # Verify persona was created using SQL file
    persona_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/personas/test_get_persona_by_id_v4_complete.sql",
        params=GetPersonaByIdSqlParams(persona_id=UUID(data["personaId"])),
    )
    typed_persona = GetPersonaByIdSqlRow.model_validate(persona_result.model_dump())
    assert typed_persona.persona_id is not None
    assert typed_persona.name == "Department Persona"
    assert typed_persona.description == "Test Description"
    assert typed_persona.instructions == "Test instructions"


async def test_create_persona_validation_error(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a persona with invalid data."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/personas/create",
        json={
            "name": "",  # Empty name should fail
            "description": "",
            "department_ids": [],
            "active": True,
            "color": "#3B82F6",
            "icon": "Brain",
            "instructions": None,
            "example_ids": [],
        },
    )

    # Should fail due to validation
    assert response.status_code in [400, 422]

