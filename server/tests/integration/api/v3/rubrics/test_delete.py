"""Route tests for POST /api/v3/rubrics/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_delete_rubric(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a rubric that is not in use."""
    profile_id = await get_superadmin_alias(db)

    # Create a rubric without any usage
    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) "
        "VALUES('Deletable Rubric', 'Test', 100, 70, true) RETURNING id"
    )

    response = await client.post(
        "/api/v3/rubrics/delete",
        json={"rubricId": str(rubric_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Rubric deleted successfully"

    # Verify rubric was deleted
    rubric = await db.fetchrow("SELECT * FROM rubrics WHERE id = $1", rubric_id)
    assert rubric is None


async def test_delete_rubric_in_use(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that deleting a rubric linked to simulations fails."""
    profile_id = await get_superadmin_alias(db)

    # Create a rubric
    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) "
        "VALUES('Used Rubric', 'Test', 100, 70, true) RETURNING id"
    )

    # Link rubric to a simulation (this makes it "in use")
    await db.execute(
        "INSERT INTO simulations(title, description, active, rubric_id) "
        "VALUES('Test Sim', 'Test', true, $1)",
        rubric_id,
    )

    response = await client.post(
        "/api/v3/rubrics/delete",
        json={"rubricId": str(rubric_id)},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "in use" in data["detail"].lower()

    # Verify rubric was not deleted
    rubric = await db.fetchrow("SELECT * FROM rubrics WHERE id = $1", rubric_id)
    assert rubric is not None


async def test_delete_rubric_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent rubric."""
    profile_id = await get_superadmin_alias(db)

    fake_rubric_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/rubrics/delete",
        json={"rubricId": fake_rubric_id},
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
