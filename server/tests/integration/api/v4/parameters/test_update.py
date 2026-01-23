"""Route tests for POST /api/v4/parameters/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestParameterItemSqlParams,
    CreateTestParameterItemSqlRow,
    CreateTestParameterSqlParams,
    CreateTestParameterSqlRow,
    GetCsDeptIdSqlRow,
    GetParameterByIdSqlParams,
    GetParameterByIdSqlRow,
    GetParameterItemsSqlParams,
    GetParameterItemsSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_update_parameter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a parameter with new items."""
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

    # Create a parameter first using SQL file
    parameter_result = await execute_sql_typed(
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
    typed_parameter = CreateTestParameterSqlRow.model_validate(
        parameter_result.model_dump()
    )
    assert typed_parameter.parameter_id is not None
    parameter_id = typed_parameter.parameter_id

    # Create an initial item using SQL file
    item_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_create_test_parameter_item_v4_complete.sql",
        params=CreateTestParameterItemSqlParams(
            input_parameter_id=parameter_id,
            item_name="Original Item",
            item_description="Original Item Description",
            item_value="original",
        ),
    )
    typed_item = CreateTestParameterItemSqlRow.model_validate(item_result.model_dump())
    assert typed_item.parameter_item_id is not None
    item_id = typed_item.parameter_item_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/parameters/update",
        json={
            "parameter_id": str(parameter_id),
            "name": "Updated Parameter",
            "description": "Updated Description",
            "numerical": True,
            "active": False,
            "document_parameter": True,
            "simulation_parameter": True,
            "department_ids": [str(dept_id)],
            "parameter_items": [
                {
                    "name": "Updated Item 1",
                    "description": "Updated Item 1 Description",
                    "value": "updated1",
                    "department_ids": [str(dept_id)],
                },
                {
                    "name": "Updated Item 2",
                    "description": "Updated Item 2 Description",
                    "value": "updated2",
                    "department_ids": None,
                },
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Parameter 'Updated Parameter' updated successfully"

    # Verify parameter was updated using SQL file
    parameter_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_get_parameter_by_id_v4_complete.sql",
        params=GetParameterByIdSqlParams(parameter_id=parameter_id),
    )
    typed_parameter = GetParameterByIdSqlRow.model_validate(
        parameter_result.model_dump()
    )
    assert typed_parameter.name == "Updated Parameter"
    assert typed_parameter.description == "Updated Description"
    assert typed_parameter.numerical is True
    assert typed_parameter.active is False
    assert typed_parameter.document_parameter is True
    assert typed_parameter.simulation_parameter is True

    # Verify old item was deleted and new items were created using SQL file
    # Check if old item still exists
    old_items_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_get_parameter_items_v4_complete.sql",
        params=GetParameterItemsSqlParams(parameter_id=parameter_id),
    )
    typed_items = GetParameterItemsSqlRow.model_validate(old_items_result.model_dump())
    # Old item should not be in the list (it was replaced)
    old_item_exists = any(item.parameter_item_id == item_id for item in typed_items)
    assert old_item_exists is False

    # Verify new items were created
    assert len(typed_items) == 2
    assert typed_items[0].name == "Updated Item 1"
    assert typed_items[1].name == "Updated Item 2"


async def test_update_parameter_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent parameter."""
    await get_superadmin_alias(db)

    fake_parameter_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/parameters/update",
        json={
            "parameter_id": fake_parameter_id,
            "name": "Updated Parameter",
            "description": "Updated Description",
            "numerical": False,
            "active": True,
            "document_parameter": False,
            "simulation_parameter": False,
            "department_ids": None,
            "parameter_items": [],
        },
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
