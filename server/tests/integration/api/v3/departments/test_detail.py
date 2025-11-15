"""Route tests for POST /api/v3/departments/detail endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_department_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting department detail with all data."""
    profile_id = await get_superadmin_alias(db)

    # Create a department first
    dept_id = await db.fetchval(
        "INSERT INTO departments(title, description, active) "
        "VALUES ('Test Department', 'Test Description', true) RETURNING id"
    )

    response = await client.post(
        "/api/v3/departments/detail",
        json={"departmentId": str(dept_id), "profileId": profile_id},
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


async def test_get_department_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test department detail raises error for non-existent department."""
    profile_id = await get_superadmin_alias(db)

    fake_dept_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/departments/detail",
        json={"departmentId": fake_dept_id, "profileId": profile_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()

