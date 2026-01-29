"""Route tests for POST /api/v4/cohorts/get endpoint (new mode)."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateCohortDepartmentLinkSqlParams,
    CreateProfileDepartmentLinkSqlParams,
    CreateTestCohortSqlParams,
    CreateTestCohortSqlRow,
    GetFirstDepartmentSqlRow,
    GetOrCreateTestProfileSqlParams,
    GetOrCreateTestProfileSqlRow,
)

from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_get_cohort_new(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default cohort detail."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    # Use unified get endpoint with cohort_id = null for new mode
    response = await client.post(
        "/api/v4/cohorts/get",
        json={
            "cohort_id": None,
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
    assert "simulations" in data
    assert isinstance(data["simulations"], list)


async def test_get_cohort_new_with_default_cohort(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default cohort detail when a cohort exists for user's departments."""
    profile_id = await get_superadmin_alias(db)

    # Get department using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # Create a cohort linked to the user's department using SQL file
    cohort_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/cohorts/test_create_test_cohort_v4_complete.sql",
        params=CreateTestCohortSqlParams(
            title="Default Cohort",
            description="Default Description",
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

    # Link profile to department using SQL file
    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/cohorts/test_create_profile_department_link_v4_complete.sql",
        params=CreateProfileDepartmentLinkSqlParams(
            profile_id=profile_id, department_id=dept_id
        ),
    )

    # v4 routes get profile_id from router dependency
    # Use unified get endpoint with cohort_id = null for new mode
    response = await client.post(
        "/api/v4/cohorts/get",
        json={
            "cohort_id": None,
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
    assert "simulations" in data
    assert isinstance(data["simulations"], list)


async def test_get_cohort_new_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test default cohort detail when no cohort exists for user's departments."""
    # Create a profile not linked to any department using SQL file
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

    # v4 routes get profile_id from router dependency
    # Use unified get endpoint with cohort_id = null for new mode
    response = await client.post(
        "/api/v4/cohorts/get",
        json={
            "cohort_id": None,
            "draft_id": None,
            "descriptions_search": None,
            "simulation_search": None,
            "simulation_show_selected": None,
            "current_simulation_ids": None,
            "mcp": False,
        },
    )

    # Should return 200 with default data (new mode always returns data)
    assert response.status_code == 200
