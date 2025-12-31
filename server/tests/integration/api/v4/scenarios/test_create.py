"""Route tests for POST /api/v4/scenarios/create endpoint."""

import uuid
from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore
from tests.sql.types import GetScenarioByIdSqlParams, GetScenarioByIdSqlRow
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_create_scenario_minimal(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a scenario with minimal fields."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/scenarios/create",
        json={
            "name": "Test Scenario",
            "problem_statement": "Test problem statement",
            "problem_statement_versions": None,
            "department_ids": None,
            "active": True,
            "persona_ids": None,
            "document_ids": [],
            "objective_ids": [],
            "parameters": {},
            "hints_enabled": False,
            "objectives_enabled": True,
            "image_input_enabled": False,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "scenarioId" in data
    assert data["message"] == "Scenario 'Test Scenario' created successfully"

    # Verify scenario was created using SQL file
    scenario_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_get_scenario_by_id_v4_complete.sql",
        params=GetScenarioByIdSqlParams(scenario_id=UUID(data["scenarioId"])),
    )
    typed_scenario = GetScenarioByIdSqlRow.model_validate(scenario_result.model_dump())
    assert typed_scenario.scenario_id is not None
    assert typed_scenario.name == "Test Scenario"
    assert typed_scenario.active is True

    # Verify self-referencing tree edge was created - using inline SQL temporarily
    tree_edge = await db.fetchrow(
        "SELECT * FROM scenario_tree WHERE parent_id = $1 AND child_id = $1",
        UUID(data["scenarioId"]),
    )
    assert tree_edge is not None

    # Verify problem statement was created - using inline SQL temporarily
    problem_statement = await db.fetchrow(
        "SELECT * FROM scenario_problem_statements WHERE scenario_id = $1 AND active = true",
        UUID(data["scenarioId"]),
    )
    assert problem_statement is not None
    assert problem_statement["problem_statement"] == "Test problem statement"


async def test_create_scenario_with_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a scenario with department links."""
    await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/scenarios/create",
        json={
            "name": "Test Scenario with Depts",
            "problem_statement": "Test problem",
            "problem_statement_versions": None,
            "department_ids": [str(dept_id)],
            "active": True,
            "persona_ids": None,
            "document_ids": [],
            "objective_ids": [],
            "parameters": {},
            "hints_enabled": False,
            "objectives_enabled": True,
            "image_input_enabled": False,
        },
    )

    assert response.status_code == 200
    data = response.json()

    # Verify department link was created - using inline SQL temporarily
    dept_link = await db.fetchrow(
        "SELECT * FROM scenario_departments WHERE scenario_id = $1 AND department_id = $2",
        UUID(data["scenarioId"]),
        UUID(dept_id),
    )
    assert dept_link is not None
    assert dept_link["active"] is True

