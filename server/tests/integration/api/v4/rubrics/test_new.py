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
    assert "standard_groups" in data
    assert "valid_department_ids" in data

    # Check that it returns blank/default values for a new rubric
    assert data["name"] == "" or data["name"] is None
    assert data["description"] == "" or data["description"] is None
    assert isinstance(data["department_ids"], list)
    assert len(data["department_ids"]) == 0  # Should be empty array for new rubric
    assert isinstance(data["standard_group_ids"], list)
    assert len(data["standard_group_ids"]) == 0  # Should be empty array for new rubric
    assert isinstance(data["standard_groups"], list)
    assert len(data["standard_groups"]) == 0  # Should be empty array for new rubric
    assert isinstance(data["valid_department_ids"], list)
    assert data["points"] == 0  # Should be 0 for new rubric
    assert data["pass_points"] == 0  # Should be 0 for new rubric
    assert data["active"] is True  # Default to true for new rubric
