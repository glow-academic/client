"""Route tests for POST /api/v4/scenarios/duplicate endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateScenarioDepartmentLinkV4SqlParams,
    CreateTestScenarioV4SqlParams,
    CreateTestScenarioV4SqlRow,
    GetScenarioDepartmentLinksV4SqlParams,
    GetScenarioDepartmentLinksV4SqlRow,
    GetScenarioDepartmentLinkV4SqlParams,
    GetScenarioDepartmentLinkV4SqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_duplicate_scenario_with_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a scenario with department links."""
    await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    # Create a scenario using SQL file

    scenario_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_create_test_scenario_v4_complete.sql",
        params=CreateTestScenarioV4SqlParams(
            scenario_name="Original Scenario",
            scenario_problem_statement="Test problem",
        ),
    )
    typed_scenario = CreateTestScenarioV4SqlRow.model_validate(
        scenario_result.model_dump()
    )
    assert typed_scenario.scenario_id is not None
    scenario_id = typed_scenario.scenario_id

    # Link to department using SQL file

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_create_scenario_department_link_v4_complete.sql",
        params=CreateScenarioDepartmentLinkV4SqlParams(
            input_scenario_id=scenario_id,
            input_department_id=UUID(dept_id),
        ),
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

    # Verify department link was duplicated using SQL file

    new_dept_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_get_scenario_department_link_v4_complete.sql",
        params=GetScenarioDepartmentLinkV4SqlParams(
            input_scenario_id=new_scenario_id,
            input_department_id=UUID(dept_id),
        ),
    )
    typed_new_dept_link = GetScenarioDepartmentLinkV4SqlRow.model_validate(
        new_dept_link_result.model_dump()
    )
    assert typed_new_dept_link.scenario_id is not None
    assert typed_new_dept_link.active is True


async def test_duplicate_scenario_without_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a scenario without department links (cross-department)."""
    await get_superadmin_alias(db)

    # Create a scenario using SQL file

    scenario_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_create_test_scenario_v4_complete.sql",
        params=CreateTestScenarioV4SqlParams(
            scenario_name="Cross-Dept Scenario",
            scenario_problem_statement="Test problem",
        ),
    )
    typed_scenario = CreateTestScenarioV4SqlRow.model_validate(
        scenario_result.model_dump()
    )
    assert typed_scenario.scenario_id is not None
    scenario_id = typed_scenario.scenario_id

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/scenarios/duplicate",
        json={"scenarioId": str(scenario_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    new_scenario_id = UUID(data["scenarioId"])

    # Verify no department links were created (original had none) using SQL file

    dept_links_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_get_scenario_department_links_v4_complete.sql",
        params=GetScenarioDepartmentLinksV4SqlParams(input_scenario_id=new_scenario_id),
    )
    # execute_sql_typed returns a single row, so we check if it's None or empty
    typed_dept_links = GetScenarioDepartmentLinksV4SqlRow.model_validate(
        dept_links_result.model_dump()
    )
    # If no links exist, the function should return NULL values
    assert typed_dept_links.scenario_id is None
