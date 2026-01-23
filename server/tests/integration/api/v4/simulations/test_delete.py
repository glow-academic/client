"""Route tests for POST /api/v4/simulations/delete endpoint."""

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


async def test_delete_simulation(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a simulation that is not in use."""
    await get_superadmin_alias(db)

    # Get or create rubric using SQL file
    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/simulations/test_get_or_create_rubric_v4_complete.sql",
        params=None,
    )
    typed_rubric = GetOrCreateRubricV4SqlRow.model_validate(rubric_result.model_dump())
    assert typed_rubric.rubric_id is not None
    rubric_id = typed_rubric.rubric_id

    # Create a simulation without any usage using SQL file
    simulation_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/simulations/test_create_test_simulation_with_rubric_v4_complete.sql",
        params=CreateTestSimulationWithRubricV4SqlParams(
            rubric_id=rubric_id,
            title="Deletable Simulation",
            description="Test",
            active=True,
            practice_simulation=False,
        ),
    )
    typed_simulation = CreateTestSimulationWithRubricV4SqlRow.model_validate(
        simulation_result.model_dump()
    )
    assert typed_simulation.simulation_id is not None
    simulation_id = typed_simulation.simulation_id

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/simulations/delete",
        json={"simulationId": str(simulation_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "deleted successfully" in data["message"].lower()

    # Verify simulation was deleted using SQL file
    from tests.sql.types import GetSimulationByIdV4SqlParams, GetSimulationByIdV4SqlRow

    deleted_simulation_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/simulations/test_get_simulation_by_id_v4_complete.sql",
        params=GetSimulationByIdV4SqlParams(input_simulation_id=simulation_id),
    )
    typed_deleted_simulation = GetSimulationByIdV4SqlRow.model_validate(
        deleted_simulation_result.model_dump()
    )
    assert typed_deleted_simulation.simulation_id is None
