"""Route tests for POST /api/v4/parameters/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestParameterItemSqlParams,
    CreateTestParameterItemSqlRow,
    CreateTestParameterSqlParams,
    CreateTestParameterSqlRow,
    CreateTestScenarioWithParameterItemSqlParams,
    CreateTestScenarioWithParameterItemSqlRow,
    GetParameterByIdSqlParams,
    GetParameterByIdSqlRow,
    GetParameterItemsSqlParams,
    GetParameterItemsSqlRow,
)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_delete_parameter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a parameter that is not in use."""
    await get_superadmin_alias(db)

    # Create a parameter with items using SQL files
    parameter_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/parameters/test_create_test_parameter_v4_complete.sql",
        params=CreateTestParameterSqlParams(
            parameter_name="Test Parameter",
            parameter_description="Test Description",
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

    # Create an item using SQL file
    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/parameters/test_create_test_parameter_item_v4_complete.sql",
        params=CreateTestParameterItemSqlParams(
            input_parameter_id=parameter_id,
            item_name="Test Item",
            item_description="Test Item Description",
            item_value="test",
        ),
    )

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/parameters/delete",
        json={"parameter_id": str(parameter_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Parameter 'Test Parameter' deleted successfully"

    # Verify parameter was deleted using SQL file
    parameter_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/parameters/test_get_parameter_by_id_v4_complete.sql",
        params=GetParameterByIdSqlParams(parameter_id=parameter_id),
    )
    # Should return empty result
    assert len(parameter_result) == 0

    # Verify items were cascade deleted using SQL file
    items_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/parameters/test_get_parameter_items_v4_complete.sql",
        params=GetParameterItemsSqlParams(parameter_id=parameter_id),
    )
    typed_items = GetParameterItemsSqlRow.model_validate(items_result.model_dump())
    assert len(typed_items) == 0


async def test_delete_parameter_in_use(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a parameter that is in use by scenarios."""
    await get_superadmin_alias(db)

    # Create a parameter using SQL file
    parameter_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/parameters/test_create_test_parameter_v4_complete.sql",
        params=CreateTestParameterSqlParams(
            parameter_name="In Use Parameter",
            parameter_description="Test Description",
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

    # Create a parameter item using SQL file
    item_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/parameters/test_create_test_parameter_item_v4_complete.sql",
        params=CreateTestParameterItemSqlParams(
            input_parameter_id=parameter_id,
            item_name="Test Item",
            item_description="Test Item Description",
            item_value="test",
        ),
    )
    typed_item = CreateTestParameterItemSqlRow.model_validate(item_result.model_dump())
    assert typed_item.parameter_item_id is not None
    item_id = typed_item.parameter_item_id

    # Create a scenario that uses this parameter item using SQL file
    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/parameters/test_create_test_scenario_with_parameter_item_v4_complete.sql",
        params=CreateTestScenarioWithParameterItemSqlParams(parameter_item_id=item_id),
    )

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/parameters/delete",
        json={"parameter_id": str(parameter_id)},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "in use" in data["detail"].lower()


async def test_delete_parameter_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent parameter."""
    await get_superadmin_alias(db)

    fake_parameter_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/parameters/delete",
        json={"parameter_id": fake_parameter_id},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
