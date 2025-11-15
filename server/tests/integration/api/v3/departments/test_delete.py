"""Route tests for POST /api/v3/departments/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest

pytestmark = pytest.mark.asyncio


async def test_delete_department(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a department."""
    # Create a department first
    dept_id = await db.fetchval(
        "INSERT INTO departments(title, description, active) "
        "VALUES ('Test Department', 'Test', true) RETURNING id"
    )

    response = await client.post(
        "/api/v3/departments/delete",
        json={"departmentId": str(dept_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Department deleted successfully"

    # Verify department was deleted
    dept = await db.fetchrow("SELECT * FROM departments WHERE id = $1", dept_id)
    assert dept is None


async def test_delete_department_in_use(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a department that is in use."""
    # Create a department
    dept_id = await db.fetchval(
        "INSERT INTO departments(title, description, active) "
        "VALUES ('Test Department', 'Test', true) RETURNING id"
    )

    # Create a simulation linked to this department
    rubric_id = await db.fetchval("SELECT id FROM rubrics LIMIT 1")
    if not rubric_id:
        rubric_id = await db.fetchval(
            "INSERT INTO rubrics(name, description, points, pass_points, active) "
            "VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
        )

    simulation_id = await db.fetchval(
        "INSERT INTO simulations(title, description, active, practice_simulation, rubric_id) "
        "VALUES ('Test Simulation', 'Test', true, false, $1) RETURNING id",
        rubric_id,
    )

    # Link simulation to department
    await db.execute(
        "INSERT INTO simulation_departments(simulation_id, department_id, active) "
        "VALUES ($1, $2, true)",
        simulation_id,
        dept_id,
    )

    response = await client.post(
        "/api/v3/departments/delete",
        json={"departmentId": str(dept_id)},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "in use" in data["detail"].lower()


async def test_delete_department_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent department."""
    fake_dept_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/departments/delete",
        json={"departmentId": fake_dept_id},
    )

    # The endpoint now properly checks if department exists and returns 404
    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
