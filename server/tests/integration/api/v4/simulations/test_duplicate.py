"""Route tests for POST /api/v4/simulations/duplicate endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestSimulationWithRubricV4SqlParams,
    CreateTestSimulationWithRubricV4SqlRow,
    GetOrCreateRubricV4SqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_duplicate_simulation(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a simulation."""
    await get_superadmin_alias(db)

    # Get or create rubric using SQL file
    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/simulations/test_get_or_create_rubric_v4_complete.sql",
        params=None,
    )
    typed_rubric = GetOrCreateRubricV4SqlRow.model_validate(rubric_result.model_dump())
    assert typed_rubric.rubric_id is not None
    rubric_id = typed_rubric.rubric_id

    # Create a simulation using SQL file
    simulation_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/simulations/test_create_test_simulation_with_rubric_v4_complete.sql",
        params=CreateTestSimulationWithRubricV4SqlParams(
            rubric_id=rubric_id,
            title="Original Simulation",
            description="Original Description",
            active=True,
            practice_simulation=False,
        ),
    )
    typed_simulation = CreateTestSimulationWithRubricV4SqlRow.model_validate(
        simulation_result.model_dump()
    )
    assert typed_simulation.simulation_id is not None
    simulation_id = typed_simulation.simulation_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/simulations/duplicate",
        json={"simulationId": str(simulation_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "success" in data
    assert data["success"] is True
    assert "simulationId" in data
    assert data["simulationId"] != str(simulation_id)  # Should be a new ID


async def test_duplicate_simulation_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a non-existent simulation."""
    await get_superadmin_alias(db)

    fake_simulation_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/simulations/duplicate",
        json={"simulationId": fake_simulation_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
