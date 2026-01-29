"""Route tests for POST /api/v4/departments/duplicate endpoint."""

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


async def test_duplicate_department(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a department."""
    await get_superadmin_alias(db)

    # Create a department using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_create_test_department_v4_complete.sql",
        params=CreateTestDepartmentSqlParams(
            title="Original Department", description="Original Description"
        ),
    )
    typed_dept = CreateTestDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/departments/duplicate",
        json={"departmentId": str(dept_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "departmentId" in data
    assert data["departmentId"] != str(dept_id)  # New department ID
    assert "duplicated successfully" in data["message"].lower()

    # Verify duplicate was created using SQL file
    duplicate_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_get_department_by_id_v4_complete.sql",
        params=GetDepartmentByIdSqlParams(department_id=UUID(data["departmentId"])),
    )
    typed_duplicate = GetDepartmentByIdSqlRow.model_validate(
        duplicate_result.model_dump()
    )
    assert typed_duplicate.department_id is not None
    # Duplicate adds " Copy" to the title
    assert typed_duplicate.title == "Original Department Copy"
    assert typed_duplicate.description == "Original Description"


async def test_duplicate_department_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a non-existent department."""
    await get_superadmin_alias(db)

    fake_dept_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/departments/duplicate",
        json={"departmentId": fake_dept_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
