"""Route tests for POST /api/v3/personas/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_list_personas(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting personas list with mappings."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/personas/list",
        json={"profileId": profile_id},
        headers={"X-Bypass-Cache": "1"},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "personas" in data
    assert "scenario_mapping" in data
    assert "model_mapping" in data
    assert "department_mapping" in data
    assert "scenario_options" in data
    assert "model_options" in data
    assert "reasoning_options" not in data
    assert "temperature_options" not in data
    assert "department_options" in data
    assert isinstance(data["personas"], list)
    assert len(data["personas"]) >= 0

    # If there are personas, verify structure
    if data["personas"]:
        for persona in data["personas"]:
            assert "persona_id" in persona
            assert "name" in persona
            assert "color" in persona
            assert "icon" in persona
            assert "active" in persona
            assert "scenario_ids" in persona
            assert "can_edit" in persona
            assert "can_duplicate" in persona
            assert "can_delete" in persona


async def test_list_personas_empty(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting personas list when no personas exist."""
    await get_superadmin_alias(db)

    # Create a new profile with no department access
    new_profile_id = await db.fetchval(
        "INSERT INTO profiles (first_name, last_name, role, active) "
        "VALUES ('Test', 'User', 'guest', true) RETURNING id"
    )
    await db.execute(
        "INSERT INTO profile_emails(profile_id, email, is_primary, active) "
        "VALUES($1, 'redacted@purdue.edu', true, true)",
        new_profile_id
    )

    response = await client.post(
        "/api/v3/personas/list",
        json={"profileId": str(new_profile_id)},
        headers={"X-Bypass-Cache": "1"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["personas"] == []
