"""Route tests for POST /api/v4/personas/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateScenarioPersonaLinkV4SqlParams,
    CreateTestPersonaSqlParams,
    CreateTestPersonaSqlRow,
    CreateTestScenarioSqlParams,
    CreateTestScenarioSqlRow,
    GetPersonaByIdSqlParams,
    GetPersonaByIdSqlRow,
)

from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_delete_persona(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a persona."""
    await get_superadmin_alias(db)

    # Create a persona using SQL file
    persona_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/personas/test_create_test_persona_v4_complete.sql",
        params=CreateTestPersonaSqlParams(
            persona_name="Persona To Delete",
            description="Description",
            color="#3B82F6",
            icon="Brain",
            active=True,
        ),
    )
    typed_persona = CreateTestPersonaSqlRow.model_validate(persona_result.model_dump())
    assert typed_persona.persona_id is not None
    persona_id = typed_persona.persona_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/personas/delete",
        json={"personaId": str(persona_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Persona 'Persona To Delete' deleted successfully"

    # Verify persona was deleted using SQL file
    persona_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/personas/test_get_persona_by_id_v4_complete.sql",
        params=GetPersonaByIdSqlParams(persona_id=persona_id),
    )
    typed_persona = GetPersonaByIdSqlRow.model_validate(persona_result.model_dump())
    # Should return None or empty result when not found
    assert typed_persona.persona_id is None


async def test_delete_persona_in_use(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a persona that is in use by scenarios."""
    await get_superadmin_alias(db)

    # Create a persona using SQL file
    persona_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/personas/test_create_test_persona_v4_complete.sql",
        params=CreateTestPersonaSqlParams(
            persona_name="Persona In Use",
            description="Description",
            color="#3B82F6",
            icon="Brain",
            active=True,
        ),
    )
    typed_persona = CreateTestPersonaSqlRow.model_validate(persona_result.model_dump())
    assert typed_persona.persona_id is not None
    persona_id = typed_persona.persona_id

    # Create a scenario using SQL file
    scenario_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/scenarios/test_create_test_scenario_v4_complete.sql",
        params=CreateTestScenarioSqlParams(
            scenario_name="Test Scenario",
            scenario_problem_statement="Test problem statement",
        ),
    )
    typed_scenario = CreateTestScenarioSqlRow.model_validate(
        scenario_result.model_dump()
    )
    assert typed_scenario.scenario_id is not None
    scenario_id = typed_scenario.scenario_id

    # Link persona to scenario using SQL file

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/scenarios/test_create_scenario_persona_link_v4_complete.sql",
        params=CreateScenarioPersonaLinkV4SqlParams(
            input_scenario_id=scenario_id,
            input_persona_id=persona_id,
        ),
    )

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/personas/delete",
        json={"personaId": str(persona_id)},
    )

    assert response.status_code == 400
    assert "in use" in response.json()["detail"].lower()


async def test_delete_persona_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent persona."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/personas/delete",
        json={"personaId": "00000000-0000-0000-0000-000000000000"},
    )

    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()
