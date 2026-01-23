"""Route tests for POST /api/v4/cohorts/search endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateCohortDepartmentLinkSqlParams,
    CreateTestCohortSqlParams,
    CreateTestCohortSqlRow,
    GetFirstDepartmentSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_search_profiles_for_cohort(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test searching profiles for adding to a cohort."""
    await get_superadmin_alias(db)

    # Get department using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # Create a cohort using SQL file
    cohort_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/cohorts/test_create_test_cohort_v4_complete.sql",
        params=CreateTestCohortSqlParams(
            title="Test Cohort",
            description="Test Description",
            active=True,
        ),
    )
    typed_cohort = CreateTestCohortSqlRow.model_validate(cohort_result.model_dump())
    assert typed_cohort.cohort_id is not None
    cohort_id = typed_cohort.cohort_id

    # Link cohort to department using SQL file
    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/cohorts/test_create_cohort_department_link_v4_complete.sql",
        params=CreateCohortDepartmentLinkSqlParams(
            cohort_id=cohort_id, department_id=dept_id
        ),
    )

    # v4 routes get profile_id from router dependency
    # Note: API uses p_cohort_id, p_dept_ids, p_query field names
    response = await client.post(
        "/api/v4/cohorts/search",
        json={
            "p_cohort_id": str(cohort_id),
            "p_dept_ids": [str(dept_id)],
            "p_query": "",
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "profiles" in data
    assert isinstance(data["profiles"], list)


async def test_search_profiles_for_cohort_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test searching profiles for a non-existent cohort."""
    await get_superadmin_alias(db)

    fake_cohort_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    # Note: API uses p_cohort_id, p_dept_ids, p_query field names
    response = await client.post(
        "/api/v4/cohorts/search",
        json={
            "p_cohort_id": fake_cohort_id,
            "p_dept_ids": [],
            "p_query": "",
        },
    )

    # Should return 200 with empty results or 404
    assert response.status_code in [200, 404]
