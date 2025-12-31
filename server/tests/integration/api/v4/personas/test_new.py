"""Route tests for POST /api/v4/personas/new endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_persona_new(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default persona detail."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/personas/new",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["name"] == ""
    assert data["description"] == ""
    assert data["active"] is True
    assert "color" in data
    assert "icon" in data
    assert data["can_edit"] is True
    assert data["can_duplicate"] is False
    assert data["can_delete"] is False
    assert "valid_department_ids" in data
    assert "preset_colors" in data
    assert "suggested_icons" in data
    assert "valid_icons" in data

