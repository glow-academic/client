"""Route tests for POST /api/v4/cohorts/duplicate endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateCohortDepartmentLinkV4SqlParams,
    CreateTestCohortSqlParams,
    CreateTestCohortSqlRow,
    GetCohortByIdSqlParams,
    GetCohortByIdSqlRow,
    GetFirstDepartmentSqlParams,
    GetFirstDepartmentSqlRow,
)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_duplicate_cohort(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a cohort."""
    await get_superadmin_alias(db)

    # Create a cohort using SQL file
    cohort_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/cohorts/test_create_test_cohort_v4_complete.sql",
        params=CreateTestCohortSqlParams(
            title="Original Cohort",
            description="Original Description",
            active=True,
        ),
    )
    typed_cohort = CreateTestCohortSqlRow.model_validate(cohort_result.model_dump())
    assert typed_cohort.cohort_id is not None
    cohort_id = typed_cohort.cohort_id

    # Link to department using inline SQL (no test SQL file for this yet)
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/departments/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # Link to department using SQL file
    from tests.sql.types import CreateCohortDepartmentLinkV4SqlParams

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/cohorts/test_create_cohort_department_link_v4_complete.sql",
        params=CreateCohortDepartmentLinkV4SqlParams(
            input_cohort_id=cohort_id,
            input_department_id=dept_id,
        ),
    )

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/cohorts/duplicate",
        json={"cohortId": str(cohort_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "cohortId" in data
    assert data["cohortId"] != str(cohort_id)  # New cohort ID

    # Verify duplicate was created using SQL file
    duplicate_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/cohorts/test_get_cohort_by_id_v4_complete.sql",
        params=GetCohortByIdSqlParams(cohort_id=UUID(data["cohortId"])),
    )
    typed_duplicate = GetCohortByIdSqlRow.model_validate(duplicate_result.model_dump())
    assert typed_duplicate.cohort_id is not None
    assert typed_duplicate.title == "Original Cohort Copy"  # SQL adds " Copy"
    assert typed_duplicate.description == "Original Description"
