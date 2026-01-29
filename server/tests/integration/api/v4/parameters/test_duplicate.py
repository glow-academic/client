"""Route tests for POST /api/v4/parameters/duplicate endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateParameterItemDepartmentLinkSqlParams,
    CreateTestParameterItemSqlParams,
    CreateTestParameterItemSqlRow,
    CreateTestParameterSqlParams,
    CreateTestParameterSqlRow,
    GetCsDeptIdSqlRow,
    GetParameterByIdSqlParams,
    GetParameterByIdSqlRow,
    GetParameterItemDepartmentLinksSqlParams,
    GetParameterItemDepartmentLinksSqlRow,
    GetParameterItemsSqlParams,
    GetParameterItemsSqlRow,
)

from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_duplicate_parameter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a parameter with items and department links."""
    await get_superadmin_alias(db)

    # Get department ID using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/helpers/test_get_cs_dept_id_v4_complete.sql",
        params=None,
    )
    typed_dept = GetCsDeptIdSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # Create an original parameter using SQL file
    original_parameter_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_create_test_parameter_v4_complete.sql",
        params=CreateTestParameterSqlParams(
            parameter_name="Original Parameter",
            parameter_description="Original Description",
            parameter_numerical=False,
            parameter_active=True,
            parameter_document_parameter=False,
            parameter_simulation_parameter=False,
        ),
    )
    typed_original_parameter = CreateTestParameterSqlRow.model_validate(
        original_parameter_result.model_dump()
    )
    assert typed_original_parameter.parameter_id is not None
    original_parameter_id = typed_original_parameter.parameter_id

    # Create parameter items with department links using SQL files
    item1_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_create_test_parameter_item_v4_complete.sql",
        params=CreateTestParameterItemSqlParams(
            input_parameter_id=original_parameter_id,
            item_name="Item 1",
            item_description="Item 1 Description",
            item_value="value1",
        ),
    )
    typed_item1 = CreateTestParameterItemSqlRow.model_validate(
        item1_result.model_dump()
    )
    assert typed_item1.parameter_item_id is not None
    item1_id = typed_item1.parameter_item_id

    item2_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_create_test_parameter_item_v4_complete.sql",
        params=CreateTestParameterItemSqlParams(
            input_parameter_id=original_parameter_id,
            item_name="Item 2",
            item_description="Item 2 Description",
            item_value="value2",
        ),
    )
    typed_item2 = CreateTestParameterItemSqlRow.model_validate(
        item2_result.model_dump()
    )
    assert typed_item2.parameter_item_id is not None
    item2_id = typed_item2.parameter_item_id

    # Link departments to items using SQL files
    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_create_parameter_item_department_link_v4_complete.sql",
        params=CreateParameterItemDepartmentLinkSqlParams(
            parameter_item_id=item1_id, department_id=dept_id
        ),
    )

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_create_parameter_item_department_link_v4_complete.sql",
        params=CreateParameterItemDepartmentLinkSqlParams(
            parameter_item_id=item2_id, department_id=dept_id
        ),
    )

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/parameters/duplicate",
        json={"parameter_id": str(original_parameter_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "parameter_id" in data
    assert data["message"] == "Parameter 'Original Parameter' duplicated successfully"

    duplicated_parameter_id = data["parameter_id"]
    assert duplicated_parameter_id != str(original_parameter_id)

    # Verify duplicated parameter was created using SQL file
    duplicated_parameter_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_get_parameter_by_id_v4_complete.sql",
        params=GetParameterByIdSqlParams(parameter_id=duplicated_parameter_id),
    )
    typed_duplicated_parameter = GetParameterByIdSqlRow.model_validate(
        duplicated_parameter_result.model_dump()
    )
    assert typed_duplicated_parameter.name == "Original Parameter Copy"
    assert typed_duplicated_parameter.description == "Original Description"
    assert typed_duplicated_parameter.numerical is False
    assert (
        typed_duplicated_parameter.active is False
    )  # Duplicated parameters are inactive by default

    # Verify items were duplicated using SQL file
    duplicated_items_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_get_parameter_items_v4_complete.sql",
        params=GetParameterItemsSqlParams(parameter_id=duplicated_parameter_id),
    )
    typed_duplicated_items = GetParameterItemsSqlRow.model_validate(
        duplicated_items_result.model_dump()
    )
    assert len(typed_duplicated_items) == 2
    assert typed_duplicated_items[0].name == "Item 1"
    assert typed_duplicated_items[1].name == "Item 2"

    # Verify department links were copied for items using SQL file
    dup_item1_id = typed_duplicated_items[0].parameter_item_id
    dup_dept_links1_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_get_parameter_item_department_links_v4_complete.sql",
        params=GetParameterItemDepartmentLinksSqlParams(parameter_item_id=dup_item1_id),
    )
    typed_dup_dept_links1 = GetParameterItemDepartmentLinksSqlRow.model_validate(
        dup_dept_links1_result.model_dump()
    )
    assert len(typed_dup_dept_links1) == 1
    assert typed_dup_dept_links1[0].department_id == dept_id

    dup_item2_id = typed_duplicated_items[1].parameter_item_id
    dup_dept_links2_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_get_parameter_item_department_links_v4_complete.sql",
        params=GetParameterItemDepartmentLinksSqlParams(parameter_item_id=dup_item2_id),
    )
    typed_dup_dept_links2 = GetParameterItemDepartmentLinksSqlRow.model_validate(
        dup_dept_links2_result.model_dump()
    )
    assert len(typed_dup_dept_links2) == 1
    assert typed_dup_dept_links2[0].department_id == dept_id


async def test_duplicate_parameter_without_department_links(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a parameter that has no department links."""
    await get_superadmin_alias(db)

    # Create an original parameter without department links using SQL file
    original_parameter_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_create_test_parameter_v4_complete.sql",
        params=CreateTestParameterSqlParams(
            parameter_name="No Dept Parameter",
            parameter_description="Test Description",
            parameter_numerical=False,
            parameter_active=True,
            parameter_document_parameter=False,
            parameter_simulation_parameter=False,
        ),
    )
    typed_original_parameter = CreateTestParameterSqlRow.model_validate(
        original_parameter_result.model_dump()
    )
    assert typed_original_parameter.parameter_id is not None
    original_parameter_id = typed_original_parameter.parameter_id

    # Create parameter items without department links using SQL file
    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_create_test_parameter_item_v4_complete.sql",
        params=CreateTestParameterItemSqlParams(
            input_parameter_id=original_parameter_id,
            item_name="Item 1",
            item_description="Item 1 Description",
            item_value="value1",
        ),
    )

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/parameters/duplicate",
        json={"parameter_id": str(original_parameter_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    duplicated_parameter_id = data["parameter_id"]

    # Verify items were duplicated using SQL file
    duplicated_items_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_get_parameter_items_v4_complete.sql",
        params=GetParameterItemsSqlParams(parameter_id=duplicated_parameter_id),
    )
    typed_duplicated_items = GetParameterItemsSqlRow.model_validate(
        duplicated_items_result.model_dump()
    )
    assert len(typed_duplicated_items) == 1

    # Verify no department links were created (since original had none) using SQL file
    dup_item_id = typed_duplicated_items[0].parameter_item_id
    dup_dept_links_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_get_parameter_item_department_links_v4_complete.sql",
        params=GetParameterItemDepartmentLinksSqlParams(parameter_item_id=dup_item_id),
    )
    typed_dup_dept_links = GetParameterItemDepartmentLinksSqlRow.model_validate(
        dup_dept_links_result.model_dump()
    )
    assert len(typed_dup_dept_links) == 0


async def test_duplicate_parameter_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a non-existent parameter."""
    await get_superadmin_alias(db)

    fake_parameter_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/parameters/duplicate",
        json={"parameter_id": fake_parameter_id},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
