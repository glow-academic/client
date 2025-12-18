"""Route tests for POST /api/v3/profile/context endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_profile_context(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting profile context."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/profile/context",
        json={
            "actualProfileId": profile_id,
            "effectiveProfileId": profile_id,
            "pathname": "/home",
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "actualProfile" in data
    assert "effectiveProfile" in data
    assert "departments" in data
    assert "departmentIds" in data
    assert "cohorts" in data
    assert "cohortIds" in data
    assert "simulations" in data
    assert "simulationIds" in data
    assert "simulatableProfiles" in data
    assert "earliestAttemptDate" in data
    assert "availableSections" in data
    assert "redirectPath" in data

    # Verify profile data
    assert data["actualProfile"]["id"] == profile_id
    assert data["effectiveProfile"]["id"] == profile_id


async def test_get_profile_context_guest_profile_id(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test profile context with guest profile UUID."""
    # Create a default guest profile
    guest_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, role, default_profile) "
        "VALUES('Guest', 'User', 'guest', true) "
        "RETURNING id"
    )
    await db.execute(
        "INSERT INTO profile_emails(profile_id, email, is_primary, active) "
        "VALUES($1, 'redacted@purdue.edu', true, true) "
        "ON CONFLICT DO NOTHING",
        guest_id,
    )

    # Create a guest profile for testing
    guest_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, role, default_profile) "
        "VALUES('Guest', 'User', 'guest', true) "
        "RETURNING id"
    )

    response = await client.post(
        "/api/v3/profile/context",
        json={
            "actualProfileId": str(guest_id),
            "effectiveProfileId": str(guest_id),
            "pathname": "/home",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["effectiveProfile"]["id"] == str(guest_id)
    assert data["effectiveProfile"]["role"] == "guest"


async def test_get_profile_context_emulation_authorized(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test profile context with authorized emulation."""
    superadmin_id = await get_superadmin_alias(db)

    # Create a target profile (TA role - superadmin can emulate)
    target_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, role) "
        "VALUES('Target', 'User', 'member') "
        "RETURNING id"
    )
    await db.execute(
        "INSERT INTO profile_emails(profile_id, email, is_primary, active) "
        "VALUES($1, 'redacted@purdue.edu', true, true) "
        "ON CONFLICT DO NOTHING",
        target_id,
    )

    response = await client.post(
        "/api/v3/profile/context",
        json={
            "actualProfileId": superadmin_id,
            "effectiveProfileId": str(target_id),
            "pathname": "/home",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["actualProfile"]["id"] == superadmin_id
    assert data["effectiveProfile"]["id"] == str(target_id)


async def test_get_profile_context_emulation_unauthorized(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test profile context with unauthorized emulation."""
    # Create a TA profile (cannot emulate)
    ta_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, role) "
        "VALUES('Member', 'User', 'member') "
        "RETURNING id"
    )
    await db.execute(
        "INSERT INTO profile_emails(profile_id, email, is_primary, active) "
        "VALUES($1, 'redacted@purdue.edu', true, true) "
        "ON CONFLICT DO NOTHING",
        ta_id,
    )

    # Try to emulate superadmin (not allowed)
    superadmin_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/profile/context",
        json={
            "actualProfileId": str(ta_id),
            "effectiveProfileId": superadmin_id,
            "pathname": "/home",
        },
    )

    assert response.status_code == 403
    data = response.json()
    assert "permission" in data["detail"].lower()


async def test_get_profile_context_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test profile context with non-existent profile."""
    profile_id = await get_superadmin_alias(db)
    fake_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/profile/context",
        json={
            "actualProfileId": profile_id,
            "effectiveProfileId": fake_id,
            "pathname": "/home",
        },
    )

    # When trying to emulate a non-existent profile, authorization check fails first (403)
    # or context fetch fails (404) - either is acceptable
    assert response.status_code in [403, 404]
    data = response.json()
    assert (
        "not found" in data["detail"].lower() or "permission" in data["detail"].lower()
    )
