"""Route tests for POST /api/v4/departments/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateSimulationDepartmentLinkV4SqlParams,
    CreateTestDepartmentSqlParams,
    CreateTestDepartmentSqlRow,
    CreateTestSimulationWithRubricV4SqlParams,
    CreateTestSimulationWithRubricV4SqlRow,
    GetDepartmentByIdSqlParams,
    GetDepartmentByIdSqlRow,
    GetOrCreateRubricV4SqlRow,
)

from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_delete_department(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a department."""
    await get_superadmin_alias(db)

    # Create a department first using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_create_test_department_v4_complete.sql",
        params=CreateTestDepartmentSqlParams(
            title="Test Department", description="Test"
        ),
    )
    typed_dept = CreateTestDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/departments/delete",
        json={"departmentId": str(dept_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Department deleted successfully"

    # Verify department was deleted using SQL file
    deleted_dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_get_department_by_id_v4_complete.sql",
        params=GetDepartmentByIdSqlParams(department_id=dept_id),
    )
    typed_deleted_dept = GetDepartmentByIdSqlRow.model_validate(
        deleted_dept_result.model_dump()
    )
    assert typed_deleted_dept.department_id is None


async def test_delete_department_in_use(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a department that is in use."""
    await get_superadmin_alias(db)

    # Create a department using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_create_test_department_v4_complete.sql",
        params=CreateTestDepartmentSqlParams(
            title="Test Department", description="Test"
        ),
    )
    typed_dept = CreateTestDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # Get or create rubric using SQL file

    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/simulations/test_get_or_create_rubric_v4_complete.sql",
        params=None,
    )
    typed_rubric = GetOrCreateRubricV4SqlRow.model_validate(rubric_result.model_dump())
    assert typed_rubric.rubric_id is not None
    rubric_id = typed_rubric.rubric_id

    # Create a simulation linked to this department using SQL files
    simulation_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/simulations/test_create_test_simulation_with_rubric_v4_complete.sql",
        params=CreateTestSimulationWithRubricV4SqlParams(
            rubric_id=rubric_id,
            title="Test Simulation",
            description="Test",
            active=True,
            practice_simulation=False,
        ),
    )
    typed_simulation = CreateTestSimulationWithRubricV4SqlRow.model_validate(
        simulation_result.model_dump()
    )
    assert typed_simulation.simulation_id is not None
    simulation_id = typed_simulation.simulation_id

    # Link simulation to department using SQL file

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/simulations/test_create_simulation_department_link_v4_complete.sql",
        params=CreateSimulationDepartmentLinkV4SqlParams(
            input_simulation_id=simulation_id,
            input_department_id=dept_id,
        ),
    )

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/departments/delete",
        json={"departmentId": str(dept_id)},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "in use" in data["detail"].lower()


async def test_delete_department_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent department."""
    await get_superadmin_alias(db)

    fake_dept_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/departments/delete",
        json={"departmentId": fake_dept_id},
    )

    # The endpoint now properly checks if department exists and returns 404
    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
