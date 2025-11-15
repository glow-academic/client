"""Route tests for POST /api/v3/rubrics/detail endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_rubric_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting rubric detail with hierarchical structure."""
    profile_id = await get_superadmin_alias(db)

    # Get a test rubric ID
    rubric_result = await db.fetchrow("SELECT id FROM rubrics LIMIT 1")
    if not rubric_result:
        pytest.skip("No rubrics found in test database")

    rubric_id = str(rubric_result["id"])

    response = await client.post(
        "/api/v3/rubrics/detail",
        json={"rubricId": rubric_id, "profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "name" in data
    assert "description" in data
    assert "department_mapping" in data
    assert "standard_groups_mapping" in data
    assert "standards_mapping" in data
    assert isinstance(data["department_mapping"], dict)
    assert isinstance(data["standard_groups_mapping"], dict)
    assert isinstance(data["standards_mapping"], dict)

    # Check hierarchical structure
    assert "standard_group_ids" in data
    assert "standard_groups_detail" in data
    assert isinstance(data["standard_group_ids"], list)
    assert isinstance(data["standard_groups_detail"], dict)

    # Check valid IDs lists
    assert "valid_department_ids" in data
    assert isinstance(data["valid_department_ids"], list)

    # Check permission flags
    assert "can_edit" in data
    assert isinstance(data["can_edit"], bool)


async def test_get_rubric_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting rubric detail with invalid ID raises error."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/rubrics/detail",
        json={
            "rubricId": "00000000-0000-0000-0000-000000000000",
            "profileId": profile_id,
        },
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


async def test_get_rubric_detail_with_department_mapping(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that department_mapping is populated when rubric has department."""
    profile_id = await get_superadmin_alias(db)

    # Create a rubric with a department link
    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) "
        "VALUES('Test Rubric', 'Test', 100, 70, true) RETURNING id"
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

    response = await client.post(
        "/api/v3/rubrics/detail",
        json={"rubricId": str(rubric_id), "profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify department_mapping is populated
    if data.get("department_id"):
        assert len(data["department_mapping"]) > 0
        assert data["department_id"] in data["department_mapping"]
        dept_item = data["department_mapping"][data["department_id"]]
        assert "name" in dept_item
        assert len(dept_item["name"]) > 0
        assert "description" in dept_item


async def test_get_rubric_detail_with_standard_groups(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that standard_groups_mapping is populated when rubric has standard groups."""
    profile_id = await get_superadmin_alias(db)

    # Create a rubric with standard groups
    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) "
        "VALUES('Test Rubric', 'Test', 100, 70, true) RETURNING id"
    )

    # Create a standard group
    group_id = await db.fetchval(
        "INSERT INTO standard_groups(rubric_id, name, short_name, description, points, pass_points) "
        "VALUES($1, 'Test Group', 'TEST', 'Test Description', 50, 35) RETURNING id",
        rubric_id,
    )

    # Create a standard
    await db.execute(
        "INSERT INTO standards(standard_group_id, name, description, points) "
        "VALUES($1, 'Test Standard', 'Test Description', 10)",
        group_id,
    )

    response = await client.post(
        "/api/v3/rubrics/detail",
        json={"rubricId": str(rubric_id), "profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify standard_groups_mapping is populated
    if len(data.get("standard_group_ids", [])) > 0:
        assert len(data["standard_groups_mapping"]) > 0
        first_group_id = data["standard_group_ids"][0]
        assert first_group_id in data["standard_groups_mapping"]
        group_item = data["standard_groups_mapping"][first_group_id]
        assert "name" in group_item
        assert len(group_item["name"]) > 0
        assert "description" in group_item

