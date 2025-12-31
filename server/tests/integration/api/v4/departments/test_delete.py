"""Route tests for POST /api/v4/departments/delete endpoint."""

import uuid
from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestDepartmentSqlParams,
    CreateTestDepartmentSqlRow,
    GetDepartmentByIdSqlParams,
    GetDepartmentByIdSqlRow,
)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_delete_department(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a department."""
    await get_superadmin_alias(db)

    # Create a department first using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/departments/test_create_test_department_v4_complete.sql",
        params=CreateTestDepartmentSqlParams(title="Test Department", description="Test"),
    )
    typed_dept = CreateTestDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/departments/delete",
        json={"departmentId": str(dept_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Department deleted successfully"

    # Verify department was deleted using SQL file
    deleted_dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/departments/test_get_department_by_id_v4_complete.sql",
        params=GetDepartmentByIdSqlParams(department_id=dept_id),
    )
    typed_deleted_dept = GetDepartmentByIdSqlRow.model_validate(
        deleted_dept_result.model_dump()
    )
    assert typed_deleted_dept.department_id is None


async def test_delete_department_in_use(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a department that is in use."""
    await get_superadmin_alias(db)

    # Create a department using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/departments/test_create_test_department_v4_complete.sql",
        params=CreateTestDepartmentSqlParams(title="Test Department", description="Test"),
    )
    typed_dept = CreateTestDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # Create a simulation linked to this department - using inline SQL temporarily
    rubric_id = await db.fetchval("SELECT id FROM rubrics LIMIT 1")
    if not rubric_id:
        rubric_id = await db.fetchval(
            "INSERT INTO rubrics(name, description, points, pass_points, active) "
            "VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
        )

    simulation_id = await db.fetchval(
        "INSERT INTO simulations(title, description, active, practice_simulation, rubric_id) "
        "VALUES ('Test Simulation', 'Test', true, false, $1) RETURNING id",
        rubric_id,
    )

    # Link simulation to department
    await db.execute(
        "INSERT INTO simulation_departments(simulation_id, department_id, active) "
        "VALUES ($1, $2, true)",
        simulation_id,
        dept_id,
    )

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/departments/delete",
        json={"departmentId": str(dept_id)},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "in use" in data["detail"].lower()


async def test_delete_department_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent department."""
    await get_superadmin_alias(db)

    fake_dept_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/departments/delete",
        json={"departmentId": fake_dept_id},
    )

    # The endpoint now properly checks if department exists and returns 404
    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()

