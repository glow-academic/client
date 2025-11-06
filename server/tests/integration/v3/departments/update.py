"""Route tests for POST /api/v3/departments/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest

pytestmark = pytest.mark.asyncio


async def test_update_department(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a department."""
    # Create a department first
    dept_id = await db.fetchval(
        "INSERT INTO departments(title, description, active) "
        "VALUES ('Original Title', 'Original Description', true) RETURNING id"
    )

    response = await client.post(
        "/api/v3/departments/update",
        json={
            "departmentId": str(dept_id),
            "title": "Updated Title",
            "description": "Updated Description",
            "active": False,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Department updated successfully"

    # Verify department was updated
    dept = await db.fetchrow("SELECT * FROM departments WHERE id = $1", dept_id)
    assert dept is not None
    assert dept["title"] == "Updated Title"
    assert dept["description"] == "Updated Description"
    assert dept["active"] is False


async def test_update_department_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent department."""
    fake_dept_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/departments/update",
        json={
            "departmentId": fake_dept_id,
            "title": "Updated Title",
            "description": "Updated Description",
            "active": True,
        },
    )

    # Update should succeed even if department doesn't exist (no error raised)
    # But let's verify the department wasn't created
    dept = await db.fetchrow("SELECT * FROM departments WHERE id = $1", fake_dept_id)
    assert dept is None

