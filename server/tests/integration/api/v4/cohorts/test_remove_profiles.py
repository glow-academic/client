"""Route tests for POST /api/v4/artifacts/cohorts/remove_profiles endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateCohortProfileLinkV4SqlParams,
    CreateTestCohortSqlParams,
    CreateTestCohortSqlRow,
    GetOrCreateTestProfileSqlParams,
    GetOrCreateTestProfileSqlRow,
)

from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_remove_profiles_from_cohort(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test removing profiles from a cohort."""
    await get_superadmin_alias(db)

    # Create a cohort using SQL file
    cohort_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/cohorts/test_create_test_cohort_v4_complete.sql",
        params=CreateTestCohortSqlParams(
            title="Test Cohort",
            description="Test",
            active=True,
        ),
    )
    typed_cohort = CreateTestCohortSqlRow.model_validate(cohort_result.model_dump())
    assert typed_cohort.cohort_id is not None
    cohort_id = typed_cohort.cohort_id

    # Get or create test profile using SQL file
    profile_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/helpers/test_get_or_create_test_profile_v4_complete.sql",
        params=GetOrCreateTestProfileSqlParams(
            email="redacted@purdue.edu",
            role="guest",
            first_name="Test",
            last_name="User",
        ),
    )
    typed_profile = GetOrCreateTestProfileSqlRow.model_validate(
        profile_result.model_dump()
    )
    assert typed_profile.profile_id is not None
    profile_id = typed_profile.profile_id

    # Add profile to cohort first using SQL file

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/cohorts/test_create_cohort_profile_link_v4_complete.sql",
        params=CreateCohortProfileLinkV4SqlParams(
            input_cohort_id=cohort_id,
            input_profile_id=profile_id,
        ),
    )

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/artifacts/cohorts/remove_profiles",
        json={
            "cohortId": str(cohort_id),
            "profileIds": [str(profile_id)],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
