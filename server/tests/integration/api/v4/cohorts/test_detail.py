"""Route tests for POST /api/v4/cohorts/get endpoint (detail mode)."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestCohortSqlParams,
    CreateTestCohortSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_get_cohort_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting cohort detail."""
    await get_superadmin_alias(db)

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

    # v4 routes get profile_id from router dependency
    # Use unified get endpoint with cohort_id provided for detail mode
    response = await client.post(
        "/api/v4/cohorts/get",
        json={
            "cohort_id": str(cohort_id),
            "draft_id": None,
            "descriptions_search": None,
            "simulation_search": None,
            "simulation_show_selected": None,
            "current_simulation_ids": None,
            "mcp": False,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "name_resource" in data or "name_id" in data
    assert "description_resource" in data or "description_id" in data
    assert "cohort_exists" in data
    assert data["cohort_exists"] is True


async def test_get_cohort_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test cohort detail raises error for non-existent cohort."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    # Use unified get endpoint with cohort_id provided for detail mode
    response = await client.post(
        "/api/v4/cohorts/get",
        json={
            "cohort_id": "00000000-0000-0000-0000-000000000000",
            "draft_id": None,
            "descriptions_search": None,
            "simulation_search": None,
            "simulation_show_selected": None,
            "current_simulation_ids": None,
            "mcp": False,
        },
    )

    assert response.status_code == 404
