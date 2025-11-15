"""Route tests for POST /api/v3/scenarios/create endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id  # type: ignore
from tests.seed_helpers import get_superadmin_alias

pytestmark = pytest.mark.asyncio


async def test_create_scenario_minimal(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a scenario with minimal fields."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/scenarios/create",
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
            "copy_paste_allowed": False,
            "input_guardrail_enabled": False,
            "output_guardrail_enabled": False,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "scenarioId" in data
    assert data["message"] == "Scenario 'Test Scenario' created successfully"

    # Verify scenario was created
    scenario = await db.fetchrow(
        "SELECT * FROM scenarios WHERE id = $1", data["scenarioId"]
    )
    assert scenario is not None
    assert scenario["name"] == "Test Scenario"
    assert scenario["active"] is True

    # Verify self-referencing tree edge was created
    tree_edge = await db.fetchrow(
        "SELECT * FROM scenario_tree WHERE parent_id = $1 AND child_id = $1",
        data["scenarioId"],
    )
    assert tree_edge is not None

    # Verify problem statement was created
    problem_statement = await db.fetchrow(
        "SELECT * FROM scenario_problem_statements WHERE scenario_id = $1 AND active = true",
        data["scenarioId"],
    )
    assert problem_statement is not None
    assert problem_statement["problem_statement"] == "Test problem statement"


async def test_create_scenario_with_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a scenario with department links."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    response = await client.post(
        "/api/v3/scenarios/create",
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
            "copy_paste_allowed": False,
            "input_guardrail_enabled": False,
            "output_guardrail_enabled": False,
        },
    )

    assert response.status_code == 200
    data = response.json()

    # Verify department link was created
    dept_link = await db.fetchrow(
        "SELECT * FROM scenario_departments WHERE scenario_id = $1 AND department_id = $2",
        data["scenarioId"],
        dept_id,
    )
    assert dept_link is not None
    assert dept_link["active"] is True
