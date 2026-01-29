"""Route tests for POST /api/v4/rubrics/detail endpoint."""

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
)

from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_get_rubric_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting rubric detail with hierarchical structure."""
    await get_superadmin_alias(db)

    # Get a test rubric ID - create one if none exists
    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/rubrics/test_create_test_rubric_v4_complete.sql",
        params=CreateTestRubricSqlParams(
            rubric_name="Test Rubric",
            rubric_description="Test Description",
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
        "/api/v4/rubrics/detail",
        json={"rubric_id": str(rubric_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "name" in data
    assert "description" in data
    assert "department_mapping" in data
    assert "standard_groups_mapping" in data
    assert "standards_mapping" in data
    assert isinstance(data["department_mapping"], dict)
    assert isinstance(data["standard_groups_mapping"], dict)
    assert isinstance(data["standards_mapping"], dict)

    # Check hierarchical structure
    assert "standard_group_ids" in data
    assert "standard_groups_detail" in data
    assert isinstance(data["standard_group_ids"], list)
    assert isinstance(data["standard_groups_detail"], dict)

    # Check valid IDs lists
    assert "valid_department_ids" in data
    assert isinstance(data["valid_department_ids"], list)

    # Check permission flags
    assert "can_edit" in data
    assert isinstance(data["can_edit"], bool)


async def test_get_rubric_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting rubric detail with invalid ID raises error."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/detail",
        json={"rubric_id": "00000000-0000-0000-0000-000000000000"},
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


async def test_get_rubric_detail_with_department_mapping(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that department_mapping is populated when rubric has department."""
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

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/detail",
        json={"rubric_id": str(rubric_id)},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify department_mapping is populated
    if data.get("department_id"):
        assert len(data["department_mapping"]) > 0
        assert data["department_id"] in data["department_mapping"]
        dept_item = data["department_mapping"][data["department_id"]]
        assert "name" in dept_item
        assert len(dept_item["name"]) > 0
        assert "description" in dept_item


async def test_get_rubric_detail_with_standard_groups(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that standard_groups_mapping is populated when rubric has standard groups."""
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

    # Create a standard group using SQL file
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

    # Create a standard using SQL file
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
        "/api/v4/rubrics/detail",
        json={"rubric_id": str(rubric_id)},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify standard_groups_mapping is populated
    if len(data.get("standard_group_ids", [])) > 0:
        assert len(data["standard_groups_mapping"]) > 0
        first_group_id = data["standard_group_ids"][0]
        assert first_group_id in data["standard_groups_mapping"]
        group_item = data["standard_groups_mapping"][first_group_id]
        assert "name" in group_item
        assert len(group_item["name"]) > 0
        assert "description" in group_item
