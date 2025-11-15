"""Route tests for POST /api/v3/rubrics/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_update_rubric(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a rubric."""
    profile_id = await get_superadmin_alias(db)

    # Create a rubric
    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) "
        "VALUES('Original Rubric', 'Original Description', 100, 70, true) RETURNING id"
    )

    # Get a department ID
    dept_id = await db.fetchval("SELECT id FROM departments WHERE active = true LIMIT 1")
    assert dept_id is not None

    response = await client.post(
        "/api/v3/rubrics/update",
        json={
            "rubricId": str(rubric_id),
            "name": "Updated Rubric",
            "description": "Updated Description",
            "active": False,
            "points": 200,
            "passPoints": 140,
            "department_ids": [str(dept_id)],
            "standard_groups": [
                {
                    "name": "Updated Group",
                    "short_name": "UPD",
                    "description": "Updated group description",
                    "points": 100,
                    "passPoints": 70,
                    "standards": [
                        {
                            "name": "Updated Standard",
                            "description": "Updated standard description",
                            "points": 10,
                        },
                    ],
                },
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Rubric updated successfully"

    # Verify rubric was updated
    rubric = await db.fetchrow("SELECT * FROM rubrics WHERE id = $1", rubric_id)
    assert rubric is not None
    assert rubric["name"] == "Updated Rubric"
    assert rubric["description"] == "Updated Description"
    assert rubric["points"] == 200
    assert rubric["pass_points"] == 140
    assert rubric["active"] is False

    # Verify department link was updated
    dept_link = await db.fetchrow(
        "SELECT * FROM rubric_departments WHERE rubric_id = $1 AND department_id = $2",
        rubric_id,
        dept_id,
    )
    assert dept_link is not None
    assert dept_link["active"] is True

    # Verify standard groups were replaced
    groups = await db.fetch(
        "SELECT * FROM standard_groups WHERE rubric_id = $1",
        rubric_id,
    )
    assert len(groups) == 1
    assert groups[0]["name"] == "Updated Group"

    # Verify standards were replaced
    standards = await db.fetch(
        "SELECT * FROM standards WHERE standard_group_id = $1",
        groups[0]["id"],
    )
    assert len(standards) == 1
    assert standards[0]["name"] == "Updated Standard"


async def test_update_rubric_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent rubric."""
    profile_id = await get_superadmin_alias(db)

    fake_rubric_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/rubrics/update",
        json={
            "rubricId": fake_rubric_id,
            "name": "Updated Rubric",
            "description": "Updated Description",
            "active": True,
            "points": 100,
            "passPoints": 70,
            "department_ids": [],
            "standard_groups": [],
        },
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


async def test_update_rubric_remove_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a rubric to remove department links."""
    profile_id = await get_superadmin_alias(db)

    # Create a rubric with a department link
    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) "
        "VALUES('Test Rubric', 'Test', 100, 70, true) RETURNING id"
    )

    dept_id = await db.fetchval("SELECT id FROM departments WHERE active = true LIMIT 1")
    assert dept_id is not None

    await db.execute(
        "INSERT INTO rubric_departments(rubric_id, department_id, active) "
        "VALUES($1, $2, true)",
        rubric_id,
        dept_id,
    )

    # Update to remove department links
    response = await client.post(
        "/api/v3/rubrics/update",
        json={
            "rubricId": str(rubric_id),
            "name": "Test Rubric",
            "description": "Test",
            "active": True,
            "points": 100,
            "passPoints": 70,
            "department_ids": [],
            "standard_groups": [],
        },
    )

    assert response.status_code == 200

    # Verify department links were deactivated
    dept_link = await db.fetchrow(
        "SELECT * FROM rubric_departments WHERE rubric_id = $1 AND department_id = $2",
        rubric_id,
        dept_id,
    )
    assert dept_link is not None
    assert dept_link["active"] is False

