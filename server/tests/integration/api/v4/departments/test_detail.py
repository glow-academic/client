"""Route tests for POST /api/v4/departments/detail endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestDepartmentSqlParams,
    CreateTestDepartmentSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_get_department_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting department detail with all data."""
    await get_superadmin_alias(db)

    # Create a department first using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_create_test_department_v4_complete.sql",
        params=CreateTestDepartmentSqlParams(
            title="Test Department", description="Test Description"
        ),
    )
    typed_dept = CreateTestDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/departments/detail",
        json={"departmentId": str(dept_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "title" in data
    assert "description" in data
    assert "active" in data
    assert "can_edit" in data
    assert "can_duplicate" in data
    assert "can_delete" in data
    assert "in_use" in data
    assert "staff_count" in data
    assert "total_price_spent" in data
    assert "staff" in data
    assert "cohort_mapping" in data
    assert "department_mapping" in data
    assert isinstance(data["staff"], list)


async def test_get_department_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test department detail raises error for non-existent department."""
    await get_superadmin_alias(db)

    fake_dept_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/departments/detail",
        json={"departmentId": fake_dept_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
