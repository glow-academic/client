"""Route tests for POST /api/v4/parameters/create endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
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


async def test_create_parameter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new parameter with items."""
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

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/parameters/create",
        json={
            "name": "Test Parameter",
            "description": "Test Description",
            "numerical": False,
            "active": True,
            "document_parameter": False,
            "simulation_parameter": False,
            "department_ids": [str(dept_id)],
            "parameter_items": [
                {
                    "name": "Item 1",
                    "description": "Item 1 Description",
                    "value": "value1",
                    "department_ids": [str(dept_id)],
                },
                {
                    "name": "Item 2",
                    "description": "Item 2 Description",
                    "value": "value2",
                    "department_ids": None,  # Use parameter-level department_ids
                },
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "parameter_id" in data
    assert data["message"] == "Parameter 'Test Parameter' created successfully"

    parameter_id = data["parameter_id"]

    # Verify parameter was created using SQL file
    parameter_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_get_parameter_by_id_v4_complete.sql",
        params=GetParameterByIdSqlParams(parameter_id=parameter_id),
    )
    typed_parameter = GetParameterByIdSqlRow.model_validate(
        parameter_result.model_dump()
    )
    assert typed_parameter.parameter_id == parameter_id
    assert typed_parameter.name == "Test Parameter"
    assert typed_parameter.description == "Test Description"
    assert typed_parameter.numerical is False
    assert typed_parameter.active is True

    # Verify parameter items were created using SQL file
    items_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_get_parameter_items_v4_complete.sql",
        params=GetParameterItemsSqlParams(parameter_id=parameter_id),
    )
    typed_items = GetParameterItemsSqlRow.model_validate(items_result.model_dump())
    assert len(typed_items) == 2
    assert typed_items[0].name == "Item 1"
    assert typed_items[1].name == "Item 2"

    # Verify department links were created for items using SQL file
    item1_id = typed_items[0].parameter_item_id
    dept_links_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_get_parameter_item_department_links_v4_complete.sql",
        params=GetParameterItemDepartmentLinksSqlParams(parameter_item_id=item1_id),
    )
    typed_dept_links = GetParameterItemDepartmentLinksSqlRow.model_validate(
        dept_links_result.model_dump()
    )
    assert len(typed_dept_links) == 1
    assert typed_dept_links[0].department_id == dept_id

    # Item 2 should also have department links (from parameter-level) using SQL file
    item2_id = typed_items[1].parameter_item_id
    dept_links2_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_get_parameter_item_department_links_v4_complete.sql",
        params=GetParameterItemDepartmentLinksSqlParams(parameter_item_id=item2_id),
    )
    typed_dept_links2 = GetParameterItemDepartmentLinksSqlRow.model_validate(
        dept_links2_result.model_dump()
    )
    assert len(typed_dept_links2) == 1
    assert typed_dept_links2[0].department_id == dept_id


async def test_create_parameter_minimal(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a parameter with minimal fields."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/parameters/create",
        json={
            "name": "Minimal Parameter",
            "description": "Minimal Description",
            "numerical": True,
            "active": True,
            "document_parameter": False,
            "simulation_parameter": False,
            "department_ids": None,
            "parameter_items": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "parameter_id" in data
    parameter_id = data["parameter_id"]

    # Verify parameter was created using SQL file
    parameter_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_get_parameter_by_id_v4_complete.sql",
        params=GetParameterByIdSqlParams(parameter_id=parameter_id),
    )
    typed_parameter = GetParameterByIdSqlRow.model_validate(
        parameter_result.model_dump()
    )
    assert typed_parameter.name == "Minimal Parameter"
    assert typed_parameter.numerical is True

    # Verify no items were created using SQL file
    items_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_get_parameter_items_v4_complete.sql",
        params=GetParameterItemsSqlParams(parameter_id=parameter_id),
    )
    typed_items = GetParameterItemsSqlRow.model_validate(items_result.model_dump())
    assert len(typed_items) == 0
