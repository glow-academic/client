"""Route tests for POST /api/v4/scenarios/create endpoint."""

import uuid
from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore
from tests.sql.types import (
    GetScenarioByIdSqlParams,
    GetScenarioByIdSqlRow,
    GetScenarioDepartmentLinkV4SqlParams,
    GetScenarioDepartmentLinkV4SqlRow,
    GetScenarioProblemStatementV4SqlParams,
    GetScenarioProblemStatementV4SqlRow,
    GetScenarioTreeEdgeV4SqlParams,
    GetScenarioTreeEdgeV4SqlRow,
)
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

    # Verify self-referencing tree edge was created using SQL file
    from tests.sql.types import (
        GetScenarioTreeEdgeV4SqlParams,
        GetScenarioTreeEdgeV4SqlRow,
    )

    tree_edge_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_get_scenario_tree_edge_v4_complete.sql",
        params=GetScenarioTreeEdgeV4SqlParams(
            input_scenario_id=UUID(data["scenarioId"])
        ),
    )
    typed_tree_edge = GetScenarioTreeEdgeV4SqlRow.model_validate(
        tree_edge_result.model_dump()
    )
    assert typed_tree_edge.parent_id is not None

    # Verify problem statement was created using SQL file
    from tests.sql.types import (
        GetScenarioProblemStatementV4SqlParams,
        GetScenarioProblemStatementV4SqlRow,
    )

    problem_statement_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_get_scenario_problem_statement_v4_complete.sql",
        params=GetScenarioProblemStatementV4SqlParams(
            input_scenario_id=UUID(data["scenarioId"])
        ),
    )
    typed_problem_statement = GetScenarioProblemStatementV4SqlRow.model_validate(
        problem_statement_result.model_dump()
    )
    assert typed_problem_statement.scenario_id is not None
    assert typed_problem_statement.problem_statement == "Test problem statement"


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

    # Verify department link was created using SQL file
    from tests.sql.types import (
        GetScenarioDepartmentLinkV4SqlParams,
        GetScenarioDepartmentLinkV4SqlRow,
    )

    dept_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_get_scenario_department_link_v4_complete.sql",
        params=GetScenarioDepartmentLinkV4SqlParams(
            input_scenario_id=UUID(data["scenarioId"]),
            input_department_id=UUID(dept_id),
        ),
    )
    typed_dept_link = GetScenarioDepartmentLinkV4SqlRow.model_validate(
        dept_link_result.model_dump()
    )
    assert typed_dept_link.scenario_id is not None
    assert typed_dept_link.active is True
