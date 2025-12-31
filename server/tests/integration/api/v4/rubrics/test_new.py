"""Route tests for POST /api/v4/rubrics/new endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_rubric_new(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default rubric detail with consolidated query."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/rubrics/new",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "name" in data
    assert "description" in data
    assert "department_ids" in data
    assert "active" in data
    assert "points" in data
    assert "pass_points" in data
    assert "standard_group_ids" in data
    assert "standard_groups_detail" in data
    assert "department_mapping" in data
    assert "valid_department_ids" in data

    # Check that it returns actual data
    assert data["name"] is not None
    assert data["department_ids"] is not None
    assert isinstance(data["standard_group_ids"], list)
    assert isinstance(data["standard_groups_detail"], dict)
    assert isinstance(data["department_mapping"], dict)
    assert isinstance(data["valid_department_ids"], list)

