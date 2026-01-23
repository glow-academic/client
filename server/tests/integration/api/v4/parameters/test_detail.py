"""Route tests for POST /api/v4/parameters/detail endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestParameterSqlParams,
    CreateTestParameterSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_get_parameter_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting parameter detail with all data."""
    await get_superadmin_alias(db)

    # Create a parameter first using SQL file
    parameter_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/parameters/test_create_test_parameter_v4_complete.sql",
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

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/parameters/detail",
        json={"parameter_id": str(parameter_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "name" in data
    assert "description" in data
    assert "numerical" in data
    assert "active" in data
    assert "document_parameter" in data
    assert "simulation_parameter" in data
    assert "department_ids" in data
    assert "parameter_items" in data
    assert "department_mapping" in data
    assert "valid_department_ids" in data
    assert isinstance(data["parameter_items"], list)
    assert isinstance(data["department_mapping"], dict)
    assert isinstance(data["valid_department_ids"], list)


async def test_get_parameter_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test parameter detail raises error for non-existent parameter."""
    await get_superadmin_alias(db)

    fake_parameter_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/parameters/detail",
        json={"parameter_id": fake_parameter_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
