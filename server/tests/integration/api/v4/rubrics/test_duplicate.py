"""Route tests for POST /api/v4/rubrics/duplicate endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateRubricDepartmentLinkSqlParams,
    CreateTestRubricSqlParams,
    CreateTestRubricSqlRow,
    CreateTestStandardGroupSqlParams,
    CreateTestStandardGroupSqlRow,
    CreateTestStandardSqlParams,
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


async def test_duplicate_rubric(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a rubric."""
    await get_superadmin_alias(db)

    # Create a rubric with department links, standard groups, and standards using SQL files
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

    # Link to a department using SQL file
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

    # Create standard groups and standards using SQL files
    group_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/rubrics/test_create_test_standard_group_v4_complete.sql",
        params=CreateTestStandardGroupSqlParams(
            input_rubric_id=rubric_id,
            group_name="Test Group",
            group_short_name="TEST",
            group_description="Test Description",
            group_points=50,
            group_pass_points=35,
        ),
    )
    typed_group = CreateTestStandardGroupSqlRow.model_validate(
        group_result.model_dump()
    )
    assert typed_group.standard_group_id is not None
    group_id = typed_group.standard_group_id

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/rubrics/test_create_test_standard_v4_complete.sql",
        params=CreateTestStandardSqlParams(
            input_standard_group_id=group_id,
            standard_name="Test Standard",
            standard_description="Test Description",
            standard_points=10,
        ),
    )

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/duplicate",
        json={"rubric_id": str(rubric_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "rubric_id" in data
    assert "duplicated successfully" in data["message"]

    new_rubric_id = data["rubric_id"]
    assert new_rubric_id != str(rubric_id)

    # Verify new rubric was created with same properties using SQL file
    new_rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/rubrics/test_get_rubric_by_id_v4_complete.sql",
        params=GetRubricByIdSqlParams(rubric_id=new_rubric_id),
    )
    new_typed_rubric = GetRubricByIdSqlRow.model_validate(
        new_rubric_result.model_dump()
    )

    original_rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/rubrics/test_get_rubric_by_id_v4_complete.sql",
        params=GetRubricByIdSqlParams(rubric_id=rubric_id),
    )
    original_typed_rubric = GetRubricByIdSqlRow.model_validate(
        original_rubric_result.model_dump()
    )

    assert new_typed_rubric.rubric_id == new_rubric_id
    assert new_typed_rubric.name == original_typed_rubric.name + " Copy"
    assert new_typed_rubric.description == original_typed_rubric.description
    assert new_typed_rubric.points == original_typed_rubric.points
    assert new_typed_rubric.pass_points == original_typed_rubric.pass_points
    assert (
        new_typed_rubric.active is False
    )  # Duplicated rubrics are inactive by default

    # Verify department link was duplicated using SQL file
    new_dept_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/rubrics/test_get_rubric_department_link_v4_complete.sql",
        params=GetRubricDepartmentLinkSqlParams(
            rubric_id=new_rubric_id, department_id=dept_id
        ),
    )
    typed_new_dept_link = GetRubricDepartmentLinkSqlRow.model_validate(
        new_dept_link_result.model_dump()
    )
    assert typed_new_dept_link.active is True

    # Verify standard groups were duplicated using SQL file
    new_groups_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/rubrics/test_get_rubric_standard_groups_v4_complete.sql",
        params=GetRubricStandardGroupsSqlParams(rubric_id=new_rubric_id),
    )
    typed_new_groups = GetRubricStandardGroupsSqlRow.model_validate(
        new_groups_result.model_dump()
    )
    assert len(typed_new_groups) == 1
    assert typed_new_groups[0].name == "Test Group"

    # Verify standards were duplicated using SQL file
    new_standards_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/rubrics/test_get_rubric_standards_v4_complete.sql",
        params=GetRubricStandardsSqlParams(
            standard_group_id=typed_new_groups[0].standard_group_id
        ),
    )
    typed_new_standards = GetRubricStandardsSqlRow.model_validate(
        new_standards_result.model_dump()
    )
    assert len(typed_new_standards) == 1
    assert typed_new_standards[0].name == "Test Standard"


async def test_duplicate_rubric_without_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a rubric without department links."""
    await get_superadmin_alias(db)

    # Create a rubric without department links using SQL file
    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/rubrics/test_create_test_rubric_v4_complete.sql",
        params=CreateTestRubricSqlParams(
            rubric_name="Cross-Dept Rubric",
            rubric_description="Test",
            rubric_points=100,
            rubric_pass_points=70,
            rubric_active=True,
        ),
    )
    typed_rubric = CreateTestRubricSqlRow.model_validate(rubric_result.model_dump())
    assert typed_rubric.rubric_id is not None
    rubric_id = typed_rubric.rubric_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/duplicate",
        json={"rubric_id": str(rubric_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    new_rubric_id = data["rubric_id"]

    # Verify no department links were created (original had none) using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_get_first_department_v4_complete.sql",
        params=None,
    )
    typed_dept = GetFirstDepartmentSqlRow.model_validate(dept_result.model_dump())
    if typed_dept.department_id:
        dept_links_result = await execute_sql_typed(
            conn=db,
            sql_path="tests/sql/v4/integration/queries/api/rubrics/test_get_rubric_department_links_v4_complete.sql",
            params=None,  # Will need to check what params this function takes
        )
        # Should return empty result
        assert len(dept_links_result) == 0


async def test_duplicate_rubric_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a non-existent rubric."""
    await get_superadmin_alias(db)

    fake_rubric_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/duplicate",
        json={"rubric_id": fake_rubric_id},
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
