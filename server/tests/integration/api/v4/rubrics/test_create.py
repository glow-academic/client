"""Route tests for POST /api/v4/rubrics/create endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
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


async def test_create_rubric(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new rubric with all fields."""
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
        "/api/v4/rubrics/create",
        json={
            "name": "Test Rubric",
            "description": "Test Description",
            "active": True,
            "points": 100,
            "pass_points": 70,
            "department_ids": [str(dept_id)],
            "standard_groups": [
                {
                    "name": "Communication",
                    "short_name": "COMM",
                    "description": "Communication skills",
                    "points": 50,
                    "pass_points": 35,
                    "standards": [
                        {
                            "name": "Excellent",
                            "description": "Excellent communication",
                            "points": 5,
                        },
                        {
                            "name": "Good",
                            "description": "Good communication",
                            "points": 3,
                        },
                    ],
                },
                {
                    "name": "Problem Solving",
                    "short_name": "PROB",
                    "description": "Problem solving skills",
                    "points": 50,
                    "pass_points": 35,
                    "standards": [
                        {
                            "name": "Excellent",
                            "description": "Excellent problem solving",
                            "points": 5,
                        },
                    ],
                },
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "rubric_id" in data
    assert data["message"] == "Rubric created successfully"

    rubric_id = data["rubric_id"]

    # Verify rubric was created using SQL file
    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/rubrics/test_get_rubric_by_id_v4_complete.sql",
        params=GetRubricByIdSqlParams(rubric_id=rubric_id),
    )
    typed_rubric = GetRubricByIdSqlRow.model_validate(rubric_result.model_dump())
    assert typed_rubric.rubric_id == rubric_id
    assert typed_rubric.name == "Test Rubric"
    assert typed_rubric.description == "Test Description"
    assert typed_rubric.points == 100
    assert typed_rubric.pass_points == 70
    assert typed_rubric.active is True

    # Verify department link was created using SQL file
    dept_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/rubrics/test_get_rubric_department_link_v4_complete.sql",
        params=GetRubricDepartmentLinkSqlParams(
            rubric_id=rubric_id, department_id=dept_id
        ),
    )
    typed_dept_link = GetRubricDepartmentLinkSqlRow.model_validate(
        dept_link_result.model_dump()
    )
    assert typed_dept_link.rubric_id == rubric_id
    assert typed_dept_link.department_id == dept_id
    assert typed_dept_link.active is True

    # Verify standard groups were created using SQL file
    groups_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/rubrics/test_get_rubric_standard_groups_v4_complete.sql",
        params=GetRubricStandardGroupsSqlParams(rubric_id=rubric_id),
    )
    typed_groups = GetRubricStandardGroupsSqlRow.model_validate(
        groups_result.model_dump()
    )
    assert len(typed_groups) == 2
    assert typed_groups[0].name == "Communication"
    assert typed_groups[1].name == "Problem Solving"

    # Verify standards were created using SQL file
    comm_group_id = typed_groups[0].standard_group_id
    prob_group_id = typed_groups[1].standard_group_id

    comm_standards_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/rubrics/test_get_rubric_standards_v4_complete.sql",
        params=GetRubricStandardsSqlParams(standard_group_id=comm_group_id),
    )
    typed_comm_standards = GetRubricStandardsSqlRow.model_validate(
        comm_standards_result.model_dump()
    )
    assert len(typed_comm_standards) == 2

    prob_standards_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/rubrics/test_get_rubric_standards_v4_complete.sql",
        params=GetRubricStandardsSqlParams(standard_group_id=prob_group_id),
    )
    typed_prob_standards = GetRubricStandardsSqlRow.model_validate(
        prob_standards_result.model_dump()
    )
    assert len(typed_prob_standards) == 1


async def test_create_rubric_without_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a rubric without department links."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/create",
        json={
            "name": "Cross-Dept Rubric",
            "description": "Available to all departments",
            "active": True,
            "points": 100,
            "pass_points": 70,
            "department_ids": [],
            "standard_groups": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    rubric_id = data["rubric_id"]

    # Verify no department links were created using SQL file
    # Check by trying to get any department link (should return empty)
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/departments/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    if typed_dept.department_id:
        dept_link_result = await execute_sql_typed(
            conn=db,
            sql_path="tests/sql/v4/integration/api/rubrics/test_get_rubric_department_link_v4_complete.sql",
            params=GetRubricDepartmentLinkSqlParams(
                rubric_id=rubric_id, department_id=typed_dept.department_id
            ),
        )
        # Should return empty result (no link exists)
        assert len(dept_link_result) == 0


async def test_create_rubric_without_standard_groups(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a rubric without standard groups."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/create",
        json={
            "name": "Simple Rubric",
            "description": "No standard groups",
            "active": True,
            "points": 100,
            "pass_points": 70,
            "department_ids": [],
            "standard_groups": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    rubric_id = data["rubric_id"]

    # Verify no standard groups were created using SQL file
    groups_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/rubrics/test_get_rubric_standard_groups_v4_complete.sql",
        params=GetRubricStandardGroupsSqlParams(rubric_id=rubric_id),
    )
    typed_groups = GetRubricStandardGroupsSqlRow.model_validate(
        groups_result.model_dump()
    )
    assert len(typed_groups) == 0


async def test_create_rubric_minimal(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a rubric with minimal fields."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/create",
        json={
            "name": "Minimal Rubric",
            "description": "",
            "active": True,
            "points": 100,
            "pass_points": 70,
            "department_ids": [],
            "standard_groups": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    rubric_id = data["rubric_id"]

    # Verify rubric was created using SQL file
    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/rubrics/test_get_rubric_by_id_v4_complete.sql",
        params=GetRubricByIdSqlParams(rubric_id=rubric_id),
    )
    typed_rubric = GetRubricByIdSqlRow.model_validate(rubric_result.model_dump())
    assert typed_rubric.rubric_id == rubric_id
    assert typed_rubric.name == "Minimal Rubric"
    assert typed_rubric.description == ""
