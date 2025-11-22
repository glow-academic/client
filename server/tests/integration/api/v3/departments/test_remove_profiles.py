"""Route tests for POST /api/v3/departments/remove-profiles endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_remove_profiles_from_department(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test removing profiles from a department."""
    profile_id = await get_superadmin_alias(db)

    # Create a department
    dept_id = await db.fetchval(
        "INSERT INTO departments(title, description, active) "
        "VALUES ('Test Department', 'Test', true) RETURNING id"
    )

    # Get or create profiles
    profile_id1 = await db.fetchval(
        "SELECT id FROM profiles WHERE id != $1 LIMIT 1", profile_id
    )
    if not profile_id1:
        profile_id1 = await db.fetchval(
            "INSERT INTO profiles(first_name, last_name, email, role, active) "
            "VALUES ('Test', 'User1', 'redacted@purdue.edu', 'guest', true) RETURNING id"
        )

    profile_id2 = await db.fetchval(
        "SELECT id FROM profiles WHERE id != $1 AND id != $2 LIMIT 1",
        profile_id,
        profile_id1,
    )
    if not profile_id2:
        profile_id2 = await db.fetchval(
            "INSERT INTO profiles(first_name, last_name, email, role, active) "
            "VALUES ('Test', 'User2', 'redacted@purdue.edu', 'guest', true) RETURNING id"
        )

    # Add profiles to department
    await db.execute(
        "INSERT INTO profile_departments(profile_id, department_id, active) VALUES ($1, $2, true)",
        profile_id1,
        dept_id,
    )
    await db.execute(
        "INSERT INTO profile_departments(profile_id, department_id, active) VALUES ($1, $2, true)",
        profile_id2,
        dept_id,
    )

    response = await client.post(
        "/api/v3/departments/remove-profiles",
        json={
            "departmentId": str(dept_id),
            "profileIds": [str(profile_id1), str(profile_id2)],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "Removed 2 profile(s)" in data["message"]

    # Verify profiles were removed (set to inactive, not deleted)
    profile_link1 = await db.fetchrow(
        "SELECT * FROM profile_departments WHERE department_id = $1 AND profile_id = $2 AND active = true",
        dept_id,
        profile_id1,
    )
    assert profile_link1 is None  # Should not be active

    profile_link2 = await db.fetchrow(
        "SELECT * FROM profile_departments WHERE department_id = $1 AND profile_id = $2 AND active = true",
        dept_id,
        profile_id2,
    )
    assert profile_link2 is None  # Should not be active


async def test_remove_profiles_from_department_empty_list(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test removing empty list of profiles from a department."""
    dept_id = await db.fetchval(
        "INSERT INTO departments(title, description, active) "
        "VALUES ('Test Department', 'Test', true) RETURNING id"
    )

    response = await client.post(
        "/api/v3/departments/remove-profiles",
        json={"departmentId": str(dept_id), "profileIds": []},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "Removed 0 profile(s)" in data["message"]


async def test_remove_profiles_from_department_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test removing profiles from a non-existent department."""
    fake_dept_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/departments/remove-profiles",
        json={"departmentId": fake_dept_id, "profileIds": []},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
