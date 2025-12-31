"""Route tests for POST /api/v4/departments/new endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_department_new(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default department detail for a user."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/departments/new",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "title" in data
    assert "description" in data
    assert "active" in data
    assert "can_edit" in data
    assert "can_duplicate" in data
    assert "can_delete" in data
    assert "in_use" in data
    assert "staff_count" in data
    assert "total_price_spent" in data
    assert "staff" in data
    assert "cohort_mapping" in data
    assert "department_mapping" in data
    assert isinstance(data["staff"], list)
    assert isinstance(data["cohort_mapping"], dict)
    assert isinstance(data["department_mapping"], dict)


async def test_get_department_new_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test default department detail when profile doesn't exist."""
    # Create a profile not linked to any department
    fake_profile_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency (header), not request body
    # For this test, we need to set the profile header
    response = await client.post(
        "/api/v4/departments/new",
        json={},
        headers={"X-Profile-Id": fake_profile_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()

