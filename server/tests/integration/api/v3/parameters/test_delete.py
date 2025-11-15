"""Route tests for POST /api/v3/parameters/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_delete_parameter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a parameter that is not in use."""
    # Create a parameter with items
    parameter_id = await db.fetchval(
        "INSERT INTO parameters(name, description, numerical, active, document_parameter, practice_parameter) "
        "VALUES ('Test Parameter', 'Test Description', false, true, false, false) RETURNING id"
    )

    # Create an item
    await db.execute(
        "INSERT INTO parameter_items(parameter_id, name, description, value) "
        "VALUES ($1, 'Test Item', 'Test Item Description', 'test')",
        parameter_id,
    )

    response = await client.post(
        "/api/v3/parameters/delete",
        json={"parameterId": str(parameter_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Parameter 'Test Parameter' deleted successfully"

    # Verify parameter was deleted
    parameter = await db.fetchrow(
        "SELECT * FROM parameters WHERE id = $1", parameter_id
    )
    assert parameter is None

    # Verify items were cascade deleted
    items = await db.fetch(
        "SELECT * FROM parameter_items WHERE parameter_id = $1", parameter_id
    )
    assert len(items) == 0


async def test_delete_parameter_in_use(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a parameter that is in use by scenarios."""
    # Create a parameter
    parameter_id = await db.fetchval(
        "INSERT INTO parameters(name, description, numerical, active, document_parameter, practice_parameter) "
        "VALUES ('In Use Parameter', 'Test Description', false, true, false, false) RETURNING id"
    )

    # Create a parameter item
    item_id = await db.fetchval(
        "INSERT INTO parameter_items(parameter_id, name, description, value) "
        "VALUES ($1, 'Test Item', 'Test Item Description', 'test') RETURNING id",
        parameter_id,
    )

    # Create a scenario that uses this parameter item
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) "
        "VALUES ('Test Scenario', true) RETURNING id"
    )

    # Create problem statement for scenario
    problem_statement_id = await db.fetchval(
        "INSERT INTO scenario_problem_statements(scenario_id, problem_statement, active) "
        "VALUES ($1, 'Test problem', true) RETURNING id",
        scenario_id,
    )

    # Link parameter item to scenario
    await db.execute(
        "INSERT INTO scenario_parameter_items(scenario_id, parameter_item_id, active) "
        "VALUES ($1, $2, true)",
        scenario_id,
        item_id,
    )

    response = await client.post(
        "/api/v3/parameters/delete",
        json={"parameterId": str(parameter_id)},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "in use" in data["detail"].lower()


async def test_delete_parameter_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent parameter."""
    fake_parameter_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/parameters/delete",
        json={"parameterId": fake_parameter_id},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
