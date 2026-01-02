"""Route tests for POST /api/v4/scenarios/update endpoint."""

import uuid
from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore
from tests.sql.types import GetScenarioByIdSqlParams, GetScenarioByIdSqlRow
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_update_scenario(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a scenario."""
    await get_superadmin_alias(db)

    # Create a scenario first - using inline SQL temporarily
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Original Scenario', true) RETURNING id"
    )

    # Insert self-referencing tree edge
    await db.execute(
        "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
        scenario_id,
    )

    # Create problem statement
    await db.execute(
        "INSERT INTO scenario_problem_statements(scenario_id, problem_statement, active) VALUES ($1, 'Original problem', true)",
        scenario_id,
    )

    dept_id = await get_cs_dept_id(db)

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/scenarios/update",
        json={
            "scenarioId": str(scenario_id),
            "name": "Updated Scenario",
            "problem_statement": "Updated problem statement",
            "department_ids": [str(dept_id)],
            "active": False,
            "persona_ids": None,
            "document_ids": [],
            "objective_ids": [],
            "parameters": {},
            "hints_enabled": True,
            "objectives_enabled": True,
            "image_input_enabled": False,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Scenario 'Updated Scenario' updated successfully"

    # Verify scenario was updated using SQL file
    scenario_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_get_scenario_by_id_v4_complete.sql",
        params=GetScenarioByIdSqlParams(scenario_id=scenario_id),
    )
    typed_scenario = GetScenarioByIdSqlRow.model_validate(scenario_result.model_dump())
    assert typed_scenario.scenario_id is not None
    assert typed_scenario.name == "Updated Scenario"
    assert typed_scenario.active is False

    # Verify new problem statement was created (old one deactivated) - using inline SQL temporarily
    old_ps = await db.fetchrow(
        "SELECT * FROM scenario_problem_statements WHERE scenario_id = $1 AND problem_statement = 'Original problem'",
        scenario_id,
    )
    assert old_ps is not None
    assert old_ps["active"] is False

    new_ps = await db.fetchrow(
        "SELECT * FROM scenario_problem_statements WHERE scenario_id = $1 AND active = true",
        scenario_id,
    )
    assert new_ps is not None
    assert new_ps["problem_statement"] == "Updated problem statement"

    # Verify department link was created - using inline SQL temporarily
    dept_link = await db.fetchrow(
        "SELECT * FROM scenario_departments WHERE scenario_id = $1 AND department_id = $2",
        scenario_id,
        UUID(dept_id),
    )
    assert dept_link is not None
    assert dept_link["active"] is True


async def test_update_scenario_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent scenario."""
    await get_superadmin_alias(db)

    fake_scenario_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/scenarios/update",
        json={
            "scenarioId": fake_scenario_id,
            "name": "Updated Scenario",
            "problem_statement": "Updated problem",
            "department_ids": None,
            "active": True,
            "persona_ids": None,
            "document_ids": [],
            "objective_ids": [],
            "parameters": {},
        },
    )

    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()
