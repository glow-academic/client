"""Route tests for POST /api/v4/cohorts/add_profiles endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestCohortSqlParams,
    CreateTestCohortSqlRow,
    GetOrCreateTestProfileSqlParams,
    GetOrCreateTestProfileSqlRow,
)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_add_profiles_to_cohort(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test adding profiles to a cohort."""
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

    # Get or create test profiles using SQL file
    profile1_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/helpers/test_get_or_create_test_profile_v4_complete.sql",
        params=GetOrCreateTestProfileSqlParams(
            email="redacted@purdue.edu",
            role="guest",
            first_name="Test",
            last_name="User1",
        ),
    )
    typed_profile1 = GetOrCreateTestProfileSqlRow.model_validate(
        profile1_result.model_dump()
    )
    assert typed_profile1.profile_id is not None
    profile1_id = typed_profile1.profile_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/cohorts/add_profiles",
        json={
            "cohortId": str(cohort_id),
            "profileIds": [str(profile1_id)],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
