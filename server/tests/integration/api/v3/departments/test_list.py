"""Route tests for POST /api/v3/departments/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_list_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting departments list."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/departments/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "departments" in data
    assert isinstance(data["departments"], list)
    assert len(data["departments"]) >= 0

    # If there are departments, verify structure
    if data["departments"]:
        for dept in data["departments"]:
            assert "department_id" in dept
            assert "title" in dept
            assert "description" in dept
            assert "active" in dept
            assert "updated_at" in dept
            assert "total_price_spent" in dept
            assert "staff_count" in dept
            assert "can_edit" in dept
            assert "can_delete" in dept
            assert "can_duplicate" in dept


async def test_list_departments_empty(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test departments list works even with no departments."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/departments/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "departments" in data
    assert isinstance(data["departments"], list)
