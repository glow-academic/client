"""Route tests for POST /api/v4/rubrics/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (CreateTestRubricSqlParams, CreateTestRubricSqlRow,
                             CreateTestSimulationWithRubricSqlParams,
                             CreateTestSimulationWithRubricSqlRow,
                             GetRubricByIdSqlParams, GetRubricByIdSqlRow)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_delete_rubric(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a rubric that is not in use."""
    await get_superadmin_alias(db)

    # Create a rubric without any usage using SQL file
    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/rubrics/test_create_test_rubric_v4_complete.sql",
        params=CreateTestRubricSqlParams(
            rubric_name="Deletable Rubric",
            rubric_description="Test",
            rubric_points=100,
            rubric_pass_points=70,
            rubric_active=True,
        ),
    )
    typed_rubric = CreateTestRubricSqlRow.model_validate(rubric_result.model_dump())
    assert typed_rubric.rubric_id is not None
    rubric_id = typed_rubric.rubric_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/delete",
        json={"rubric_id": str(rubric_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Rubric deleted successfully"

    # Verify rubric was deleted using SQL file
    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/rubrics/test_get_rubric_by_id_v4_complete.sql",
        params=GetRubricByIdSqlParams(rubric_id=rubric_id),
    )
    # Should return empty result
    assert len(rubric_result) == 0


async def test_delete_rubric_in_use(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that deleting a rubric linked to simulations fails."""
    await get_superadmin_alias(db)

    # Create a rubric using SQL file
    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/rubrics/test_create_test_rubric_v4_complete.sql",
        params=CreateTestRubricSqlParams(
            rubric_name="Used Rubric",
            rubric_description="Test",
            rubric_points=100,
            rubric_pass_points=70,
            rubric_active=True,
        ),
    )
    typed_rubric = CreateTestRubricSqlRow.model_validate(rubric_result.model_dump())
    assert typed_rubric.rubric_id is not None
    rubric_id = typed_rubric.rubric_id

    # Link rubric to a simulation (this makes it "in use") using SQL file
    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/rubrics/test_create_test_simulation_with_rubric_v4_complete.sql",
        params=CreateTestSimulationWithRubricSqlParams(
            input_rubric_id=rubric_id,
            simulation_name="Test Sim",
            simulation_description="Test",
            simulation_active=True,
        ),
    )

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/delete",
        json={"rubric_id": str(rubric_id)},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "in use" in data["detail"].lower()

    # Verify rubric was not deleted using SQL file
    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/rubrics/test_get_rubric_by_id_v4_complete.sql",
        params=GetRubricByIdSqlParams(rubric_id=rubric_id),
    )
    typed_rubric = GetRubricByIdSqlRow.model_validate(rubric_result.model_dump())
    assert typed_rubric.rubric_id == rubric_id


async def test_delete_rubric_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent rubric."""
    await get_superadmin_alias(db)

    fake_rubric_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/delete",
        json={"rubric_id": fake_rubric_id},
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

