"""Route tests for POST /api/v3/profile/detail endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_profile_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting profile by ID."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/profile/detail",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "profile" in data
    profile = data["profile"]
    assert profile["id"] == profile_id
    assert "firstName" in profile
    assert "lastName" in profile
    assert "emails" in profile
    assert "primaryEmail" in profile
    assert "role" in profile
    assert "active" in profile
    assert "viewedIntro" in profile
    assert "viewedChat" in profile
    assert "defaultProfile" in profile
    assert "reqPerDay" in profile
    assert "lastLogin" in profile
    assert "lastActive" in profile
    assert "createdAt" in profile
    assert "updatedAt" in profile
    assert "primaryDepartmentId" in profile


async def test_get_profile_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting non-existent profile."""
    fake_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/profile/detail",
        json={"profileId": fake_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()


async def test_get_profile_detail_guest_profile_id(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting profile with guest-profile-id resolution."""
    # Create a default guest profile
    guest_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, role, default_profile) "
        "VALUES('Guest', 'User', 'guest', true) "
        "ON CONFLICT (id) DO UPDATE SET default_profile = true "
        "RETURNING id"
    )
    # Insert email into profile_emails
    await db.execute(
        "INSERT INTO profile_emails(profile_id, email, is_primary, active) "
        "VALUES ($1, 'redacted@purdue.edu', true, true) "
        "ON CONFLICT (profile_id, email) DO NOTHING",
        guest_id
    )

    response = await client.post(
        "/api/v3/profile/detail",
        json={"profileId": "guest-profile-id"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["profile"]["id"] == str(guest_id)
    assert data["profile"]["role"] == "guest"


async def test_get_profile_detail_guest_profile_id_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test guest-profile-id when no default guest exists."""
    # Delete any existing default guest profiles
    await db.execute(
        "UPDATE profiles SET default_profile = false WHERE role = 'guest' AND default_profile = true"
    )

    response = await client.post(
        "/api/v3/profile/detail",
        json={"profileId": "guest-profile-id"},
    )

    # Should return 404 if no default guest profile exists
    assert response.status_code == 404
