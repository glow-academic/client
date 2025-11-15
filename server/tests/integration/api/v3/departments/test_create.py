"""Route tests for POST /api/v3/departments/create endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_create_department(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new department with all fields."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/departments/create",
        json={
            "title": "Test Department",
            "description": "Test Description",
            "active": True,
            "profile_id": profile_id,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "departmentId" in data
    assert data["message"] == "Department created successfully"

    # Verify department was created in database
    dept = await db.fetchrow(
        "SELECT * FROM departments WHERE id = $1", data["departmentId"]
    )
    assert dept is not None
    assert dept["title"] == "Test Department"
    assert dept["description"] == "Test Description"
    assert dept["active"] is True

    # Verify profile link was created (superadmin should be auto-linked)
    profile_link = await db.fetchrow(
        "SELECT * FROM profile_departments WHERE department_id = $1 AND profile_id = $2",
        data["departmentId"],
        profile_id,
    )
    assert profile_link is not None


async def test_create_department_minimal(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a department with minimal fields."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/departments/create",
        json={
            "title": "Minimal Department",
            "description": "",  # Empty string
            "active": True,
            "profile_id": profile_id,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "departmentId" in data

    # Verify department was created
    dept = await db.fetchrow(
        "SELECT * FROM departments WHERE id = $1", data["departmentId"]
    )
    assert dept is not None
    assert dept["title"] == "Minimal Department"
    assert dept["description"] == ""  # Empty string
