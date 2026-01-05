"""Route tests for POST /api/v4/scenarios/detail endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestScenarioV4SqlParams,
    CreateTestScenarioV4SqlRow,
)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_get_scenario_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting scenario detail."""
    await get_superadmin_alias(db)

    # Create a scenario using SQL file
    scenario_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_create_test_scenario_v4_complete.sql",
        params=CreateTestScenarioV4SqlParams(
            scenario_name="Test Scenario",
            scenario_problem_statement="Test problem statement",
        ),
    )
    typed_scenario = CreateTestScenarioV4SqlRow.model_validate(
        scenario_result.model_dump()
    )
    assert typed_scenario.scenario_id is not None
    scenario_id = typed_scenario.scenario_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/scenarios/detail",
        json={"scenarioId": str(scenario_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "name" in data
    assert data["name"] == "Test Scenario"
    assert "problem_statement" in data
    assert data["problem_statement"] == "Test problem statement"
    assert "active" in data
    assert data["active"] is True


async def test_get_scenario_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting scenario detail for non-existent scenario."""
    await get_superadmin_alias(db)

    fake_scenario_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/scenarios/detail",
        json={"scenarioId": fake_scenario_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
