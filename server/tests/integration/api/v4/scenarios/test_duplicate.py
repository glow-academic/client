"""Route tests for POST /api/v4/scenarios/duplicate endpoint."""

import uuid
from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore
from tests.sql.types import GetScenarioByIdSqlParams, GetScenarioByIdSqlRow
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_duplicate_scenario_with_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a scenario with department links."""
    await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    # Create a scenario with department link - using inline SQL temporarily
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
        "INSERT INTO scenario_problem_statements(scenario_id, problem_statement, active) VALUES ($1, 'Test problem', true)",
        scenario_id,
    )

    # Link to department
    await db.execute(
        "INSERT INTO scenario_departments(scenario_id, department_id) VALUES ($1, $2)",
        scenario_id,
        UUID(dept_id),
    )

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/scenarios/duplicate",
        json={"scenarioId": str(scenario_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "scenarioId" in data
    new_scenario_id = UUID(data["scenarioId"])
    assert new_scenario_id != scenario_id

    # Verify department link was duplicated - using inline SQL temporarily
    new_dept_link = await db.fetchrow(
        "SELECT * FROM scenario_departments WHERE scenario_id = $1 AND department_id = $2",
        new_scenario_id,
        UUID(dept_id),
    )
    assert new_dept_link is not None
    assert new_dept_link["active"] is True


async def test_duplicate_scenario_without_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a scenario without department links (cross-department)."""
    await get_superadmin_alias(db)

    # Create a scenario without department links - using inline SQL temporarily
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Cross-Dept Scenario', true) RETURNING id"
    )

    # Insert self-referencing tree edge
    await db.execute(
        "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
        scenario_id,
    )

    # Create problem statement
    await db.execute(
        "INSERT INTO scenario_problem_statements(scenario_id, problem_statement, active) VALUES ($1, 'Test problem', true)",
        scenario_id,
    )

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/scenarios/duplicate",
        json={"scenarioId": str(scenario_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    new_scenario_id = UUID(data["scenarioId"])

    # Verify no department links were created (original had none) - using inline SQL temporarily
    dept_links = await db.fetch(
        "SELECT * FROM scenario_departments WHERE scenario_id = $1",
        new_scenario_id,
    )
    assert len(dept_links) == 0
