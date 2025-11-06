"""Route tests for POST /api/v3/rubrics/create endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_create_rubric(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new rubric with all fields."""
    profile_id = await get_superadmin_alias(db)

    # Get a department ID
    dept_id = await db.fetchval("SELECT id FROM departments WHERE active = true LIMIT 1")
    assert dept_id is not None

    response = await client.post(
        "/api/v3/rubrics/create",
        json={
            "name": "Test Rubric",
            "description": "Test Description",
            "active": True,
            "points": 100,
            "passPoints": 70,
            "department_ids": [str(dept_id)],
            "standard_groups": [
                {
                    "name": "Communication",
                    "short_name": "COMM",
                    "description": "Communication skills",
                    "points": 50,
                    "passPoints": 35,
                    "standards": [
                        {
                            "name": "Excellent",
                            "description": "Excellent communication",
                            "points": 5,
                        },
                        {
                            "name": "Good",
                            "description": "Good communication",
                            "points": 3,
                        },
                    ],
                },
                {
                    "name": "Problem Solving",
                    "short_name": "PROB",
                    "description": "Problem solving skills",
                    "points": 50,
                    "passPoints": 35,
                    "standards": [
                        {
                            "name": "Excellent",
                            "description": "Excellent problem solving",
                            "points": 5,
                        },
                    ],
                },
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "rubricId" in data
    assert data["message"] == "Rubric created successfully"

    rubric_id = data["rubricId"]

    # Verify rubric was created in database
    rubric = await db.fetchrow("SELECT * FROM rubrics WHERE id = $1", rubric_id)
    assert rubric is not None
    assert rubric["name"] == "Test Rubric"
    assert rubric["description"] == "Test Description"
    assert rubric["points"] == 100
    assert rubric["pass_points"] == 70
    assert rubric["active"] is True

    # Verify department link was created
    dept_link = await db.fetchrow(
        "SELECT * FROM rubric_departments WHERE rubric_id = $1 AND department_id = $2",
        rubric_id,
        dept_id,
    )
    assert dept_link is not None
    assert dept_link["active"] is True

    # Verify standard groups were created
    groups = await db.fetch(
        "SELECT * FROM standard_groups WHERE rubric_id = $1 ORDER BY name",
        rubric_id,
    )
    assert len(groups) == 2
    assert groups[0]["name"] == "Communication"
    assert groups[1]["name"] == "Problem Solving"

    # Verify standards were created
    comm_group_id = groups[0]["id"]
    prob_group_id = groups[1]["id"]

    comm_standards = await db.fetch(
        "SELECT * FROM standards WHERE standard_group_id = $1 ORDER BY name",
        comm_group_id,
    )
    assert len(comm_standards) == 2

    prob_standards = await db.fetch(
        "SELECT * FROM standards WHERE standard_group_id = $1 ORDER BY name",
        prob_group_id,
    )
    assert len(prob_standards) == 1


async def test_create_rubric_without_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a rubric without department links."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/rubrics/create",
        json={
            "name": "Cross-Dept Rubric",
            "description": "Available to all departments",
            "active": True,
            "points": 100,
            "passPoints": 70,
            "department_ids": [],
            "standard_groups": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    rubric_id = data["rubricId"]

    # Verify no department links were created
    dept_links = await db.fetch(
        "SELECT * FROM rubric_departments WHERE rubric_id = $1",
        rubric_id,
    )
    assert len(dept_links) == 0


async def test_create_rubric_without_standard_groups(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a rubric without standard groups."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/rubrics/create",
        json={
            "name": "Simple Rubric",
            "description": "No standard groups",
            "active": True,
            "points": 100,
            "passPoints": 70,
            "department_ids": [],
            "standard_groups": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    rubric_id = data["rubricId"]

    # Verify no standard groups were created
    groups = await db.fetch(
        "SELECT * FROM standard_groups WHERE rubric_id = $1",
        rubric_id,
    )
    assert len(groups) == 0


async def test_create_rubric_minimal(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a rubric with minimal fields."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/rubrics/create",
        json={
            "name": "Minimal Rubric",
            "description": "",
            "active": True,
            "points": 100,
            "passPoints": 70,
            "department_ids": [],
            "standard_groups": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    rubric_id = data["rubricId"]

    # Verify rubric was created
    rubric = await db.fetchrow("SELECT * FROM rubrics WHERE id = $1", rubric_id)
    assert rubric is not None
    assert rubric["name"] == "Minimal Rubric"
    assert rubric["description"] == ""

