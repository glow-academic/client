"""Route tests for POST /api/v4/artifacts/departments/update endpoint."""

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

from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_update_department(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a department."""
    await get_superadmin_alias(db)

    # Create a department first using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_create_test_department_v4_complete.sql",
        params=CreateTestDepartmentSqlParams(
            title="Original Title", description="Original Description"
        ),
    )
    typed_dept = CreateTestDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/artifacts/departments/update",
        json={
            "departmentId": str(dept_id),
            "title": "Updated Title",
            "description": "Updated Description",
            "active": False,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Department updated successfully"

    # Verify department was updated using SQL file
    updated_dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_get_department_by_id_v4_complete.sql",
        params=GetDepartmentByIdSqlParams(department_id=dept_id),
    )
    typed_updated_dept = GetDepartmentByIdSqlRow.model_validate(
        updated_dept_result.model_dump()
    )
    assert typed_updated_dept.department_id is not None
    assert typed_updated_dept.title == "Updated Title"
    assert typed_updated_dept.description == "Updated Description"


async def test_update_department_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent department."""
    await get_superadmin_alias(db)

    fake_dept_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/artifacts/departments/update",
        json={
            "departmentId": fake_dept_id,
            "title": "Updated Title",
            "description": "Updated Description",
            "active": True,
        },
    )

    # Update should succeed even if department doesn't exist (no error raised)
    # But let's verify the department wasn't created using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_get_department_by_id_v4_complete.sql",
        params=GetDepartmentByIdSqlParams(department_id=UUID(fake_dept_id)),
    )
    typed_dept = GetDepartmentByIdSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is None
