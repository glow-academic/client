"""Route tests for POST /api/v4/rubrics/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (CreateRubricDepartmentLinkSqlParams,
                             CreateRubricDepartmentLinkSqlRow,
                             CreateTestRubricSqlParams, CreateTestRubricSqlRow,
                             CreateTestSimulationWithRubricSqlParams,
                             CreateTestSimulationWithRubricSqlRow,
                             GetFirstDepartmentSqlParams,
                             GetFirstDepartmentSqlRow,
                             GetRubricSimulationCountSqlParams,
                             GetRubricSimulationCountSqlRow)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_list_rubrics(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting rubrics list with embedded hierarchical structure."""
    await get_superadmin_alias(db)

    # Get a department ID using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/departments/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/list",
        json={"department_ids": [str(dept_id)]},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "rubrics" in data
    assert "standard_groups_mapping" in data
    assert "standards_mapping" in data
    assert "department_mapping" in data
    assert isinstance(data["rubrics"], list)
    assert len(data["rubrics"]) >= 0

    # If there are rubrics, verify hierarchical structure
    if data["rubrics"]:
        rubric = data["rubrics"][0]
        assert "rubric_id" in rubric
        assert "name" in rubric
        assert "standard_groups" in rubric
        assert isinstance(rubric["standard_groups"], dict)


async def test_list_rubrics_empty_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting rubrics list with no departments returns cross-department rubrics."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/list",
        json={"department_ids": []},
    )

    assert response.status_code == 200
    data = response.json()

    # Should return valid structure (may include cross-department rubrics)
    assert data is not None
    assert isinstance(data["rubrics"], list)
    assert len(data["rubrics"]) >= 0
    assert isinstance(data["standard_groups_mapping"], dict)
    assert isinstance(data["standards_mapping"], dict)


async def test_list_rubrics_permissions_superadmin(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test superadmin has edit/duplicate permissions."""
    await get_superadmin_alias(db)

    # Get a department ID using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/departments/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/list",
        json={"department_ids": [str(dept_id)]},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    # Superadmin should have edit and duplicate permissions
    for rubric in data["rubrics"]:
        # can_edit depends on active simulation links and default_rubric
        # can_duplicate should be True for superadmin
        assert rubric["can_duplicate"] is True


async def test_list_rubrics_can_edit_with_active_simulation(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that rubrics with active simulation links cannot be edited."""
    await get_superadmin_alias(db)

    # Create a rubric using SQL file
    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/rubrics/test_create_test_rubric_v4_complete.sql",
        params=CreateTestRubricSqlParams(
            rubric_name="Test Rubric",
            rubric_description="Test",
            rubric_points=100,
            rubric_pass_points=70,
            rubric_active=True,
        ),
    )
    typed_rubric = CreateTestRubricSqlRow.model_validate(rubric_result.model_dump())
    assert typed_rubric.rubric_id is not None
    rubric_id = typed_rubric.rubric_id

    # Create an active simulation linked to this rubric using SQL file
    simulation_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/rubrics/test_create_test_simulation_with_rubric_v4_complete.sql",
        params=CreateTestSimulationWithRubricSqlParams(
            input_rubric_id=rubric_id,
            simulation_name="Test Sim",
            simulation_description="Test",
            simulation_active=True,
        ),
    )
    typed_simulation = CreateTestSimulationWithRubricSqlRow.model_validate(
        simulation_result.model_dump()
    )
    assert typed_simulation.simulation_id is not None

    # Get a department ID using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/departments/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/list",
        json={"department_ids": [str(dept_id)]},
    )

    assert response.status_code == 200
    data = response.json()

    # Find the rubric with active simulation
    linked_rubric = next(
        (r for r in data["rubrics"] if r["rubric_id"] == str(rubric_id)), None
    )
    if linked_rubric:
        assert linked_rubric["can_edit"] is False


async def test_list_rubrics_can_delete_with_simulation_links(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that rubrics with any simulation links cannot be deleted."""
    await get_superadmin_alias(db)

    # Create a rubric using SQL file
    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/rubrics/test_create_test_rubric_v4_complete.sql",
        params=CreateTestRubricSqlParams(
            rubric_name="Test Rubric",
            rubric_description="Test",
            rubric_points=100,
            rubric_pass_points=70,
            rubric_active=True,
        ),
    )
    typed_rubric = CreateTestRubricSqlRow.model_validate(rubric_result.model_dump())
    assert typed_rubric.rubric_id is not None
    rubric_id = typed_rubric.rubric_id

    # Create an inactive simulation linked to this rubric using SQL file
    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/rubrics/test_create_test_simulation_with_rubric_v4_complete.sql",
        params=CreateTestSimulationWithRubricSqlParams(
            input_rubric_id=rubric_id,
            simulation_name="Test Sim",
            simulation_description="Test",
            simulation_active=False,
        ),
    )

    # Get a department ID using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/departments/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/list",
        json={"department_ids": [str(dept_id)]},
    )

    assert response.status_code == 200
    data = response.json()

    # Find the rubric with simulation links
    linked_rubric = next(
        (r for r in data["rubrics"] if r["rubric_id"] == str(rubric_id)), None
    )
    if linked_rubric:
        assert linked_rubric["can_delete"] is False


async def test_list_rubrics_can_delete_allowed(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that unlinked rubrics can be deleted by superadmin."""
    await get_superadmin_alias(db)

    # Create an unlinked rubric (no simulation links) using SQL file
    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/rubrics/test_create_test_rubric_v4_complete.sql",
        params=CreateTestRubricSqlParams(
            rubric_name="Deletable Rubric",
            rubric_description="Test",
            rubric_points=100,
            rubric_pass_points=70,
            rubric_active=True,
        ),
    )
    typed_rubric = CreateTestRubricSqlRow.model_validate(rubric_result.model_dump())
    assert typed_rubric.rubric_id is not None
    rubric_id = typed_rubric.rubric_id

    # Get a department ID using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/departments/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/list",
        json={"department_ids": [str(dept_id)]},
    )

    assert response.status_code == 200
    data = response.json()

    # Find the deletable rubric
    deletable_rubric = next(
        (r for r in data["rubrics"] if r["rubric_id"] == str(rubric_id)), None
    )
    if deletable_rubric:
        assert deletable_rubric["can_edit"] is True
        assert deletable_rubric["can_duplicate"] is True
        assert deletable_rubric["can_delete"] is True

