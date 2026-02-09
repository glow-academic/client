"""Route tests for POST /api/v4/artifacts/departments/create endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    GetDepartmentByIdSqlParams,
    GetDepartmentByIdSqlRow,
    GetProfileDepartmentLinkV4SqlParams,
    GetProfileDepartmentLinkV4SqlRow,
)

from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_create_department(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new department with all fields."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/artifacts/departments/create",
        json={
            "title": "Test Department",
            "description": "Test Description",
            "active": True,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "departmentId" in data
    assert data["message"] == "Department created successfully"

    # Verify department was created in database using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_get_department_by_id_v4_complete.sql",
        params=GetDepartmentByIdSqlParams(department_id=UUID(data["departmentId"])),
    )
    typed_dept = GetDepartmentByIdSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    assert typed_dept.title == "Test Department"
    assert typed_dept.description == "Test Description"

    # Verify profile link was created (superadmin should be auto-linked) using SQL file
    profile_id = await get_superadmin_alias(db)

    profile_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_get_profile_department_link_v4_complete.sql",
        params=GetProfileDepartmentLinkV4SqlParams(
            input_department_id=UUID(data["departmentId"]),
            input_profile_id=UUID(profile_id),
        ),
    )
    typed_profile_link = GetProfileDepartmentLinkV4SqlRow.model_validate(
        profile_link_result.model_dump()
    )
    assert typed_profile_link.department_id is not None


async def test_create_department_minimal(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a department with minimal fields."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/artifacts/departments/create",
        json={
            "title": "Minimal Department",
            "description": "",  # Empty string
            "active": True,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "departmentId" in data

    # Verify department was created using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_get_department_by_id_v4_complete.sql",
        params=GetDepartmentByIdSqlParams(department_id=UUID(data["departmentId"])),
    )
    typed_dept = GetDepartmentByIdSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    assert typed_dept.title == "Minimal Department"
    assert typed_dept.description == ""  # Empty string
