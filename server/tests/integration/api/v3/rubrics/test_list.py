"""Route tests for POST /api/v3/rubrics/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_list_rubrics(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting rubrics list with embedded hierarchical structure."""
    profile_id = await get_superadmin_alias(db)

    # Get a department ID
    dept_id = await db.fetchval(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    assert dept_id is not None

    response = await client.post(
        "/api/v3/rubrics/list",
        json={"profileId": profile_id, "departmentIds": [str(dept_id)]},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "rubrics" in data
    assert "standard_groups_mapping" in data
    assert "standards_mapping" in data
    assert "department_mapping" in data
    assert isinstance(data["rubrics"], list)
    assert len(data["rubrics"]) >= 0

    # If there are rubrics, verify hierarchical structure
    if data["rubrics"]:
        rubric = data["rubrics"][0]
        assert "rubric_id" in rubric
        assert "name" in rubric
        assert "standard_groups" in rubric
        assert isinstance(rubric["standard_groups"], dict)


async def test_list_rubrics_empty_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting rubrics list with no departments returns cross-department rubrics."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/rubrics/list",
        json={"profileId": profile_id, "departmentIds": []},
    )

    assert response.status_code == 200
    data = response.json()

    # Should return valid structure (may include cross-department rubrics)
    assert data is not None
    assert isinstance(data["rubrics"], list)
    assert len(data["rubrics"]) >= 0
    assert isinstance(data["standard_groups_mapping"], dict)
    assert isinstance(data["standards_mapping"], dict)


async def test_list_rubrics_permissions_superadmin(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test superadmin has edit/duplicate permissions."""
    profile_id = await get_superadmin_alias(db)

    # Get a department ID
    dept_id = await db.fetchval(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    assert dept_id is not None

    response = await client.post(
        "/api/v3/rubrics/list",
        json={"profileId": profile_id, "departmentIds": [str(dept_id)]},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    # Superadmin should have edit and duplicate permissions
    for rubric in data["rubrics"]:
        # can_edit depends on active simulation links and default_rubric
        # can_duplicate should be True for superadmin
        assert rubric["can_duplicate"] is True


async def test_list_rubrics_can_edit_with_active_simulation(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that rubrics with active simulation links cannot be edited."""
    profile_id = await get_superadmin_alias(db)

    # Create a rubric
    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) "
        "VALUES('Test Rubric', 'Test', 100, 70, true) RETURNING id"
    )

    # Create an active simulation linked to this rubric
    await db.execute(
        "INSERT INTO simulations(title, description, active, rubric_id) "
        "VALUES('Test Sim', 'Test', true, $1)",
        rubric_id,
    )

    # Get a department ID
    dept_id = await db.fetchval(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    assert dept_id is not None

    response = await client.post(
        "/api/v3/rubrics/list",
        json={"profileId": profile_id, "departmentIds": [str(dept_id)]},
    )

    assert response.status_code == 200
    data = response.json()

    # Find the rubric with active simulation
    linked_rubric = next(
        (r for r in data["rubrics"] if r["rubric_id"] == str(rubric_id)), None
    )
    assert linked_rubric is not None
    assert linked_rubric["can_edit"] is False


async def test_list_rubrics_can_delete_with_simulation_links(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that rubrics with any simulation links cannot be deleted."""
    profile_id = await get_superadmin_alias(db)

    # Create a rubric
    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) "
        "VALUES('Test Rubric', 'Test', 100, 70, true) RETURNING id"
    )

    # Create an inactive simulation linked to this rubric
    await db.execute(
        "INSERT INTO simulations(title, description, active, rubric_id) "
        "VALUES('Test Sim', 'Test', false, $1)",
        rubric_id,
    )

    # Get a department ID
    dept_id = await db.fetchval(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    assert dept_id is not None

    response = await client.post(
        "/api/v3/rubrics/list",
        json={"profileId": profile_id, "departmentIds": [str(dept_id)]},
    )

    assert response.status_code == 200
    data = response.json()

    # Find the rubric with simulation links
    linked_rubric = next(
        (r for r in data["rubrics"] if r["rubric_id"] == str(rubric_id)), None
    )
    assert linked_rubric is not None
    assert linked_rubric["can_delete"] is False


async def test_list_rubrics_can_delete_allowed(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that unlinked rubrics can be deleted by superadmin."""
    profile_id = await get_superadmin_alias(db)

    # Create an unlinked rubric (no simulation links)
    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) "
        "VALUES('Deletable Rubric', 'Test', 100, 70, true) RETURNING id"
    )

    # Get a department ID
    dept_id = await db.fetchval(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    assert dept_id is not None

    response = await client.post(
        "/api/v3/rubrics/list",
        json={"profileId": profile_id, "departmentIds": [str(dept_id)]},
    )

    assert response.status_code == 200
    data = response.json()

    # Find the deletable rubric
    deletable_rubric = next(
        (r for r in data["rubrics"] if r["rubric_id"] == str(rubric_id)), None
    )
    assert deletable_rubric is not None
    assert deletable_rubric["can_edit"] is True
    assert deletable_rubric["can_duplicate"] is True
    assert deletable_rubric["can_delete"] is True
