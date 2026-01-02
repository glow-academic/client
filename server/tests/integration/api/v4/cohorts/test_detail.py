"""Route tests for POST /api/v4/cohorts/detail endpoint."""

from uuid import UUID

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
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_get_cohort_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting cohort detail."""
    await get_superadmin_alias(db)

    # Create a cohort using SQL file
    cohort_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/cohorts/test_create_test_cohort_v4_complete.sql",
        params=CreateTestCohortSqlParams(
            title="Test Cohort",
            description="Test Description",
            active=True,
        ),
    )
    typed_cohort = CreateTestCohortSqlRow.model_validate(cohort_result.model_dump())
    assert typed_cohort.cohort_id is not None
    cohort_id = typed_cohort.cohort_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/cohorts/detail",
        json={"cohortId": str(cohort_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "title" in data or "name" in data
    assert "description" in data
    assert "active" in data


async def test_get_cohort_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test cohort detail raises error for non-existent cohort."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/cohorts/detail",
        json={"cohortId": "00000000-0000-0000-0000-000000000000"},
    )

    assert response.status_code == 404
