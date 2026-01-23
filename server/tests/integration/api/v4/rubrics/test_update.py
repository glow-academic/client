"""Route tests for POST /api/v4/rubrics/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateRubricDepartmentLinkSqlParams,
    CreateTestRubricSqlParams,
    CreateTestRubricSqlRow,
    GetFirstDepartmentSqlRow,
    GetRubricByIdSqlParams,
    GetRubricByIdSqlRow,
    GetRubricDepartmentLinkSqlParams,
    GetRubricDepartmentLinkSqlRow,
    GetRubricStandardGroupsSqlParams,
    GetRubricStandardGroupsSqlRow,
    GetRubricStandardsSqlParams,
    GetRubricStandardsSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_update_rubric(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a rubric."""
    await get_superadmin_alias(db)

    # Create a rubric using SQL file
    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/rubrics/test_create_test_rubric_v4_complete.sql",
        params=CreateTestRubricSqlParams(
            rubric_name="Original Rubric",
            rubric_description="Original Description",
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
        sql_path="tests/sql/v4/integration/queries/api/departments/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/update",
        json={
            "rubric_id": str(rubric_id),
            "name": "Updated Rubric",
            "description": "Updated Description",
            "active": False,
            "points": 200,
            "pass_points": 140,
            "department_ids": [str(dept_id)],
            "standard_groups": [
                {
                    "name": "Updated Group",
                    "short_name": "UPD",
                    "description": "Updated group description",
                    "points": 100,
                    "pass_points": 70,
                    "standards": [
                        {
                            "name": "Updated Standard",
                            "description": "Updated standard description",
                            "points": 10,
                        },
                    ],
                },
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Rubric updated successfully"

    # Verify rubric was updated using SQL file
    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/rubrics/test_get_rubric_by_id_v4_complete.sql",
        params=GetRubricByIdSqlParams(rubric_id=rubric_id),
    )
    typed_rubric = GetRubricByIdSqlRow.model_validate(rubric_result.model_dump())
    assert typed_rubric.name == "Updated Rubric"
    assert typed_rubric.description == "Updated Description"
    assert typed_rubric.points == 200
    assert typed_rubric.pass_points == 140
    assert typed_rubric.active is False

    # Verify department link was updated using SQL file
    dept_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/rubrics/test_get_rubric_department_link_v4_complete.sql",
        params=GetRubricDepartmentLinkSqlParams(
            rubric_id=rubric_id, department_id=dept_id
        ),
    )
    typed_dept_link = GetRubricDepartmentLinkSqlRow.model_validate(
        dept_link_result.model_dump()
    )
    assert typed_dept_link.active is True

    # Verify standard groups were replaced using SQL file
    groups_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/rubrics/test_get_rubric_standard_groups_v4_complete.sql",
        params=GetRubricStandardGroupsSqlParams(rubric_id=rubric_id),
    )
    typed_groups = GetRubricStandardGroupsSqlRow.model_validate(
        groups_result.model_dump()
    )
    assert len(typed_groups) == 1
    assert typed_groups[0].name == "Updated Group"

    # Verify standards were replaced using SQL file
    standards_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/rubrics/test_get_rubric_standards_v4_complete.sql",
        params=GetRubricStandardsSqlParams(
            standard_group_id=typed_groups[0].standard_group_id
        ),
    )
    typed_standards = GetRubricStandardsSqlRow.model_validate(
        standards_result.model_dump()
    )
    assert len(typed_standards) == 1
    assert typed_standards[0].name == "Updated Standard"


async def test_update_rubric_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent rubric."""
    await get_superadmin_alias(db)

    fake_rubric_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/update",
        json={
            "rubric_id": fake_rubric_id,
            "name": "Updated Rubric",
            "description": "Updated Description",
            "active": True,
            "points": 100,
            "pass_points": 70,
            "department_ids": [],
            "standard_groups": [],
        },
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


async def test_update_rubric_remove_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a rubric to remove department links."""
    await get_superadmin_alias(db)

    # Create a rubric using SQL file
    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/rubrics/test_create_test_rubric_v4_complete.sql",
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

    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/rubrics/test_create_rubric_department_link_v4_complete.sql",
        params=CreateRubricDepartmentLinkSqlParams(
            rubric_id=rubric_id, department_id=dept_id
        ),
    )

    # Update to remove department links
    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/update",
        json={
            "rubric_id": str(rubric_id),
            "name": "Test Rubric",
            "description": "Test",
            "active": True,
            "points": 100,
            "pass_points": 70,
            "department_ids": [],
            "standard_groups": [],
        },
    )

    assert response.status_code == 200

    # Verify department links were deactivated using SQL file
    dept_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/rubrics/test_get_rubric_department_link_v4_complete.sql",
        params=GetRubricDepartmentLinkSqlParams(
            rubric_id=rubric_id, department_id=dept_id
        ),
    )
    typed_dept_link = GetRubricDepartmentLinkSqlRow.model_validate(
        dept_link_result.model_dump()
    )
    assert typed_dept_link.active is False
