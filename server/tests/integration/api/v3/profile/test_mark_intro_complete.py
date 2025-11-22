"""Route tests for POST /api/v3/profile/mark-intro-complete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_mark_intro_complete(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test marking intro as complete."""
    profile_id = await get_superadmin_alias(db)

    # Ensure viewed_intro is False initially
    await db.execute(
        "UPDATE profiles SET viewed_intro = false WHERE id = $1",
        profile_id,
    )

    response = await client.post(
        "/api/v3/profile/mark-intro-complete",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "intro marked complete" in data["message"].lower()

    # Verify in database
    profile = await db.fetchrow(
        "SELECT viewed_intro FROM profiles WHERE id = $1", profile_id
    )
    assert profile is not None
    assert profile["viewed_intro"] is True


async def test_mark_intro_complete_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test marking intro complete for non-existent profile."""
    fake_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/profile/mark-intro-complete",
        json={"profileId": fake_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()


async def test_mark_intro_complete_guest_profile_id(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test marking intro complete with guest-profile-id resolution."""
    # Create a default guest profile
    guest_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, role, default_profile, viewed_intro) "
        "VALUES('Guest', 'User', 'guest', true, false) "
        "RETURNING id"
    )
    await db.execute(
        "INSERT INTO profile_emails(profile_id, email, is_primary, active) "
        "VALUES($1, 'redacted@purdue.edu', true, true) "
        "ON CONFLICT DO NOTHING",
        guest_id
    )

    response = await client.post(
        "/api/v3/profile/mark-intro-complete",
        json={"profileId": "guest-profile-id"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

    # Verify in database
    profile = await db.fetchrow(
        "SELECT viewed_intro FROM profiles WHERE id = $1", guest_id
    )
    assert profile is not None
    assert profile["viewed_intro"] is True
