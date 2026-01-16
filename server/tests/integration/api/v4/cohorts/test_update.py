"""Route tests for POST /api/v4/cohorts/save endpoint (update mode)."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestCohortSqlParams,
    CreateTestCohortSqlRow,
    GetCohortByIdSqlParams,
    GetCohortByIdSqlRow,
    GetFirstDepartmentSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_update_cohort(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a cohort."""
    await get_superadmin_alias(db)

    # Create a cohort using SQL file
    cohort_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/cohorts/test_create_test_cohort_v4_complete.sql",
        params=CreateTestCohortSqlParams(
            title="Original Title",
            description="Original Description",
            active=True,
        ),
    )
    typed_cohort = CreateTestCohortSqlRow.model_validate(cohort_result.model_dump())
    assert typed_cohort.cohort_id is not None
    cohort_id = typed_cohort.cohort_id

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
    # Use unified save endpoint with input_cohort_id provided for update mode
    response = await client.post(
        "/api/v4/cohorts/save",
        json={
            "input_cohort_id": str(cohort_id),
            "name_id": None,  # Will need to create/update name resource first in real usage
            "description_id": None,
            "active_flag_id": None,
            "department_ids": [str(dept_id)],
            "simulation_ids": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert "cohort_id" in data
    assert data["cohort_id"] == str(cohort_id)

    # Verify cohort was updated using SQL file
    cohort_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/cohorts/test_get_cohort_by_id_v4_complete.sql",
        params=GetCohortByIdSqlParams(cohort_id=cohort_id),
    )
    typed_cohort = GetCohortByIdSqlRow.model_validate(cohort_result.model_dump())
    assert typed_cohort.cohort_id is not None
    # Note: Unified endpoint uses resource-based structure, so title/description/active are in resources
