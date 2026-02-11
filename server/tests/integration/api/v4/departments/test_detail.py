"""Route tests for POST /api/v4/artifacts/departments/get in detail mode."""

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
    await get_superadmin_alias(db)

    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_create_test_department_v4_complete.sql",
        params=CreateTestDepartmentSqlParams(
            title="Test Department", description="Test Description"
        ),
    )
    typed_dept = CreateTestDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None

    response = await client.post(
        "/api/v4/artifacts/departments/get",
        json={"department_id": str(typed_dept.department_id), "draft_id": None},
    )

    assert response.status_code == 200
    data = response.json()
    assert data.get("department_exists") is True
    assert "names" in data
    assert "descriptions" in data
    assert "flags" in data
    assert "settings" in data
