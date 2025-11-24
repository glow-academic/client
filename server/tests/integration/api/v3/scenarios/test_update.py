"""Route tests for POST /api/v3/scenarios/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_update_scenario(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a scenario."""
    await get_superadmin_alias(db)

    # Create a scenario first
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

    response = await client.post(
        "/api/v3/scenarios/update",
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
            "input_guardrail_enabled": False,
            "output_guardrail_enabled": False,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Scenario 'Updated Scenario' updated successfully"

    # Verify scenario was updated
    scenario = await db.fetchrow("SELECT * FROM scenarios WHERE id = $1", scenario_id)
    assert scenario is not None
    assert scenario["name"] == "Updated Scenario"
    assert scenario["active"] is False
    assert scenario["hints_enabled"] is True

    # Verify new problem statement was created (old one deactivated)
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

    # Verify department link was created
    dept_link = await db.fetchrow(
        "SELECT * FROM scenario_departments WHERE scenario_id = $1 AND department_id = $2",
        scenario_id,
        dept_id,
    )
    assert dept_link is not None
    assert dept_link["active"] is True


async def test_update_scenario_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent scenario."""
    fake_scenario_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/scenarios/update",
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
