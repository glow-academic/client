"""Route tests for POST /api/v4/scenarios/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestScenarioV4SqlParams,
    CreateTestScenarioV4SqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_list_scenarios(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting scenarios list."""
    await get_superadmin_alias(db)

    # Create a scenario using SQL file
    scenario_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/scenarios/test_create_test_scenario_v4_complete.sql",
        params=CreateTestScenarioV4SqlParams(
            scenario_name="Test Scenario",
            scenario_problem_statement="Test problem",
        ),
    )
    typed_scenario = CreateTestScenarioV4SqlRow.model_validate(
        scenario_result.model_dump()
    )
    assert typed_scenario.scenario_id is not None

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/scenarios/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "scenarios" in data
    assert isinstance(data["scenarios"], list)
    assert len(data["scenarios"]) >= 1

    # Verify our scenario is in the list
    scenario_ids = [s["scenario_id"] for s in data["scenarios"]]
    assert str(typed_scenario.scenario_id) in scenario_ids


async def test_list_scenarios_empty(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test scenarios list works even with no scenarios (should have seed data)."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/scenarios/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "scenarios" in data
    assert isinstance(data["scenarios"], list)
