"""Route tests for POST /api/v3/personas/new endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_email  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_persona_new(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default persona detail."""
    profile_id = await get_superadmin_email(db)

    response = await client.post(
        "/api/v3/personas/new",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["name"] == ""
    assert data["description"] == ""
    assert data["active"] is True
    assert "color" in data
    assert "icon" in data
    assert "model_id" in data
    assert data["can_edit"] is True
    assert data["can_duplicate"] is False
    assert data["can_delete"] is False
    assert "valid_model_ids" in data
    assert "valid_department_ids" in data
    assert "model_mapping" in data
    assert "department_mapping" in data
    assert "preset_colors" in data
    assert "suggested_icons" in data
    assert "valid_icons" in data


async def test_get_persona_detail_default_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default persona detail for profile with no department access."""
    # Create a new profile with no department access
    new_profile_id = await db.fetchval(
        "INSERT INTO profiles (first_name, last_name, role, active) "
        "VALUES ('Test', 'User', 'guest', true) RETURNING id"
    )
    await db.execute(
        "INSERT INTO profile_emails(profile_id, email, is_primary, active) "
        "VALUES($1, 'redacted@purdue.edu', true, true)",
        new_profile_id,
    )

    response = await client.post(
        "/api/v3/personas/new",
        json={"profileId": str(new_profile_id)},
    )

    assert response.status_code == 404
    assert "failed to fetch" in response.json()["detail"].lower()
