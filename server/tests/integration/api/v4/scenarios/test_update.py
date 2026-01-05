"""Route tests for POST /api/v4/scenarios/update endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestScenarioV4SqlParams,
    CreateTestScenarioV4SqlRow,
    GetScenarioByIdSqlParams,
    GetScenarioByIdSqlRow,
    GetScenarioDepartmentLinkV4SqlParams,
    GetScenarioDepartmentLinkV4SqlRow,
    GetScenarioProblemStatementsV4SqlParams,
    GetScenarioProblemStatementsV4SqlRow,
    GetScenarioProblemStatementV4SqlParams,
    GetScenarioProblemStatementV4SqlRow,
)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_update_scenario(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a scenario."""
    await get_superadmin_alias(db)

    # Create a scenario first using SQL file

    scenario_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_create_test_scenario_v4_complete.sql",
        params=CreateTestScenarioV4SqlParams(
            scenario_name="Original Scenario",
            scenario_problem_statement="Original problem",
        ),
    )
    typed_scenario = CreateTestScenarioV4SqlRow.model_validate(
        scenario_result.model_dump()
    )
    assert typed_scenario.scenario_id is not None
    scenario_id = typed_scenario.scenario_id

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

    # Verify new problem statement was created (old one deactivated) using SQL file

    problem_statements_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_get_scenario_problem_statements_v4_complete.sql",
        params=GetScenarioProblemStatementsV4SqlParams(input_scenario_id=scenario_id),
    )
    # Get all problem statements and check old/new
    typed_problem_statements = GetScenarioProblemStatementsV4SqlRow.model_validate(
        problem_statements_result.model_dump()
    )
    # The function returns a single row, but we need to check multiple rows
    # For now, verify the active one exists
    active_ps_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_get_scenario_problem_statement_v4_complete.sql",
        params=GetScenarioProblemStatementV4SqlParams(input_scenario_id=scenario_id),
    )
    typed_active_ps = GetScenarioProblemStatementV4SqlRow.model_validate(
        active_ps_result.model_dump()
    )
    assert typed_active_ps.problem_statement == "Updated problem statement"

    # Verify department link was created using SQL file

    dept_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_get_scenario_department_link_v4_complete.sql",
        params=GetScenarioDepartmentLinkV4SqlParams(
            input_scenario_id=scenario_id,
            input_department_id=UUID(dept_id),
        ),
    )
    typed_dept_link = GetScenarioDepartmentLinkV4SqlRow.model_validate(
        dept_link_result.model_dump()
    )
    assert typed_dept_link.scenario_id is not None
    assert typed_dept_link.active is True


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
