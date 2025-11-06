"""Route tests for POST /api/v3/rubrics/duplicate endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_duplicate_rubric(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a rubric."""
    profile_id = await get_superadmin_alias(db)

    # Create a rubric with department links, standard groups, and standards
    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) "
        "VALUES('Original Rubric', 'Original Description', 100, 70, true) RETURNING id"
    )

    # Link to a department
    dept_id = await db.fetchval("SELECT id FROM departments WHERE active = true LIMIT 1")
    assert dept_id is not None

    await db.execute(
        "INSERT INTO rubric_departments(rubric_id, department_id, active) "
        "VALUES($1, $2, true)",
        rubric_id,
        dept_id,
    )

    # Create standard groups and standards
    group_id = await db.fetchval(
        "INSERT INTO standard_groups(rubric_id, name, short_name, points, pass_points) "
        "VALUES($1, 'Test Group', 'TEST', 50, 35) RETURNING id",
        rubric_id,
    )

    await db.execute(
        "INSERT INTO standards(standard_group_id, name, points) "
        "VALUES($1, 'Test Standard', 10)",
        group_id,
    )

    response = await client.post(
        "/api/v3/rubrics/duplicate",
        json={"rubricId": str(rubric_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "rubricId" in data
    assert "duplicated successfully" in data["message"]

    new_rubric_id = data["rubricId"]
    assert new_rubric_id != str(rubric_id)

    # Verify new rubric was created with same properties
    new_rubric = await db.fetchrow("SELECT * FROM rubrics WHERE id = $1", new_rubric_id)
    original_rubric = await db.fetchrow("SELECT * FROM rubrics WHERE id = $1", rubric_id)

    assert new_rubric is not None
    assert new_rubric["name"] == original_rubric["name"] + " Copy"
    assert new_rubric["description"] == original_rubric["description"]
    assert new_rubric["points"] == original_rubric["points"]
    assert new_rubric["pass_points"] == original_rubric["pass_points"]
    assert new_rubric["active"] is False  # Duplicated rubrics are inactive by default

    # Verify department link was duplicated (if original had one)
    new_dept_link = await db.fetchrow(
        "SELECT * FROM rubric_departments WHERE rubric_id = $1 AND department_id = $2",
        new_rubric_id,
        dept_id,
    )
    assert new_dept_link is not None
    assert new_dept_link["active"] is True

    # Verify standard groups were duplicated
    new_groups = await db.fetch(
        "SELECT * FROM standard_groups WHERE rubric_id = $1",
        new_rubric_id,
    )
    assert len(new_groups) == 1
    assert new_groups[0]["name"] == "Test Group"

    # Verify standards were duplicated
    new_standards = await db.fetch(
        "SELECT * FROM standards WHERE standard_group_id = $1",
        new_groups[0]["id"],
    )
    assert len(new_standards) == 1
    assert new_standards[0]["name"] == "Test Standard"


async def test_duplicate_rubric_without_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a rubric without department links."""
    profile_id = await get_superadmin_alias(db)

    # Create a rubric without department links
    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) "
        "VALUES('Cross-Dept Rubric', 'Test', 100, 70, true) RETURNING id"
    )

    response = await client.post(
        "/api/v3/rubrics/duplicate",
        json={"rubricId": str(rubric_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    new_rubric_id = data["rubricId"]

    # Verify no department links were created (original had none)
    dept_links = await db.fetch(
        "SELECT * FROM rubric_departments WHERE rubric_id = $1",
        new_rubric_id,
    )
    assert len(dept_links) == 0


async def test_duplicate_rubric_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a non-existent rubric."""
    profile_id = await get_superadmin_alias(db)

    fake_rubric_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/rubrics/duplicate",
        json={"rubricId": fake_rubric_id},
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

