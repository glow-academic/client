"""Route tests for POST /api/v3/departments/duplicate endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest

pytestmark = pytest.mark.asyncio


async def test_duplicate_department(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a department."""
    # Create a department
    dept_id = await db.fetchval(
        "INSERT INTO departments(title, description, active) "
        "VALUES ('Original Department', 'Original Description', true) RETURNING id"
    )

    response = await client.post(
        "/api/v3/departments/duplicate",
        json={"departmentId": str(dept_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "departmentId" in data
    assert data["departmentId"] != str(dept_id)  # New department ID
    assert "duplicated successfully" in data["message"].lower()

    # Verify duplicate was created
    duplicate = await db.fetchrow(
        "SELECT * FROM departments WHERE id = $1", data["departmentId"]
    )
    assert duplicate is not None
    # Duplicate adds " Copy" to the title
    assert duplicate["title"] == "Original Department Copy"
    assert duplicate["description"] == "Original Description"


async def test_duplicate_department_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a non-existent department."""
    fake_dept_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/departments/duplicate",
        json={"departmentId": fake_dept_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
