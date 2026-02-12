"""Route tests for POST /api/v4/artifacts/departments/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_list_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting departments list."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/artifacts/departments/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "departments" in data
    assert isinstance(data["departments"], list)
    assert len(data["departments"]) >= 0
    assert "total_count" in data

    # If there are departments, verify structure
    if data["departments"]:
        for dept in data["departments"]:
            assert "department_id" in dept
            assert "name" in dept
            assert "description" in dept
            assert "is_inactive" in dept
            assert "updated_at" in dept
            assert "staff_count" in dept
            assert "can_edit" in dept
            assert "can_delete" in dept
            assert "can_duplicate" in dept


async def test_list_departments_empty(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test departments list works even with no departments."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/artifacts/departments/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "departments" in data
    assert isinstance(data["departments"], list)
    assert "total_count" in data


async def test_list_departments_with_search(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test departments list with search filter."""
    await get_superadmin_alias(db)

    response = await client.post(
        "/api/v4/artifacts/departments/list",
        json={"search": "nonexistent_department_xyz"},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "departments" in data
    assert isinstance(data["departments"], list)
    assert data["total_count"] == 0


async def test_list_departments_with_pagination(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test departments list with pagination."""
    await get_superadmin_alias(db)

    response = await client.post(
        "/api/v4/artifacts/departments/list",
        json={"page_size": 1, "page_offset": 0},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "departments" in data
    assert isinstance(data["departments"], list)
    assert len(data["departments"]) <= 1
    assert "total_count" in data
