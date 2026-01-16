"""Route tests for POST /api/v4/cohorts/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestCohortSqlParams,
    CreateTestCohortSqlRow,
    GetCohortByIdSqlParams,
    GetCohortByIdSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_delete_cohort(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a cohort."""
    await get_superadmin_alias(db)

    # Create a cohort using SQL file
    cohort_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/cohorts/test_create_test_cohort_v4_complete.sql",
        params=CreateTestCohortSqlParams(
            title="Test Cohort",
            description="Test",
            active=True,
        ),
    )
    typed_cohort = CreateTestCohortSqlRow.model_validate(cohort_result.model_dump())
    assert typed_cohort.cohort_id is not None
    cohort_id = typed_cohort.cohort_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/cohorts/delete",
        json={"cohortId": str(cohort_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Cohort deleted successfully"

    # Verify cohort was deleted using SQL file
    cohort_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/cohorts/test_get_cohort_by_id_v4_complete.sql",
        params=GetCohortByIdSqlParams(cohort_id=cohort_id),
    )
    typed_cohort = GetCohortByIdSqlRow.model_validate(cohort_result.model_dump())
    # Should return None or empty result when not found
    assert typed_cohort.cohort_id is None
