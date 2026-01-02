"""Route tests for POST /api/v4/cohorts/create endpoint."""

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
    GetFirstDepartmentSqlParams,
    GetFirstDepartmentSqlRow,
    CreateTestSimulationSqlParams,
    CreateTestSimulationSqlRow,
    GetOrCreateTestProfileSqlParams,
    GetOrCreateTestProfileSqlRow,
)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_create_cohort_minimal(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a cohort with minimal fields."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/cohorts/create",
        json={
            "title": "Minimal Cohort",
            "description": "",
            "active": True,
            "department_ids": [],
            "profile_ids": [],
            "simulation_ids": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "cohortId" in data
    assert data["message"] == "Cohort created successfully"

    # Verify cohort was created using SQL file
    cohort_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/cohorts/test_get_cohort_by_id_v4_complete.sql",
        params=GetCohortByIdSqlParams(cohort_id=UUID(data["cohortId"])),
    )
    typed_cohort = GetCohortByIdSqlRow.model_validate(cohort_result.model_dump())
    assert typed_cohort.cohort_id is not None
    assert typed_cohort.title == "Minimal Cohort"
    assert typed_cohort.description == ""
    assert typed_cohort.active is True


async def test_create_cohort_with_links(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a cohort with department, profile, and simulation links."""
    await get_superadmin_alias(db)

    # Get department ID using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/departments/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # Create a simulation using SQL file
    simulation_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/simulations/test_create_test_simulation_v4_complete.sql",
        params=CreateTestSimulationSqlParams(
            title="Test Simulation",
            description="Test",
            practice_simulation=False,
        ),
    )
    typed_simulation = CreateTestSimulationSqlRow.model_validate(
        simulation_result.model_dump()
    )
    assert typed_simulation.simulation_id is not None
    simulation_id = typed_simulation.simulation_id

    # Get or create a test profile using SQL file
    profile_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/helpers/test_get_or_create_test_profile_v4_complete.sql",
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

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/cohorts/create",
        json={
            "title": "Test Cohort",
            "description": "Test Description",
            "active": True,
            "department_ids": [str(dept_id)],
            "profile_ids": [str(profile_id)],
            "simulation_ids": [str(simulation_id)],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "cohortId" in data

    # Verify cohort was created using SQL file
    cohort_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/cohorts/test_get_cohort_by_id_v4_complete.sql",
        params=GetCohortByIdSqlParams(cohort_id=UUID(data["cohortId"])),
    )
    typed_cohort = GetCohortByIdSqlRow.model_validate(cohort_result.model_dump())
    assert typed_cohort.cohort_id is not None
    assert typed_cohort.title == "Test Cohort"
    assert typed_cohort.description == "Test Description"
