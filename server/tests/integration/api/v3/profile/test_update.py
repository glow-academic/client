"""Route tests for POST /api/v3/profile/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_update_profile(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating profile fields."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/profile/update",
        json={
            "profileId": profile_id,
            "firstName": "Updated",
            "lastName": "Name",
        },
    )

    if response.status_code != 200:
        print(f"Error response: {response.status_code} - {response.text}")
    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "profile" in data
    profile = data["profile"]
    assert profile["id"] == profile_id
    assert profile["firstName"] == "Updated"
    assert profile["lastName"] == "Name"

    # Verify in database
    db_profile = await db.fetchrow("SELECT * FROM profiles WHERE id = $1", profile_id)
    assert db_profile is not None
    assert db_profile["first_name"] == "Updated"
    assert db_profile["last_name"] == "Name"


async def test_update_profile_partial(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating only some profile fields."""
    profile_id = await get_superadmin_alias(db)

    # Get original values
    original = await db.fetchrow(
        "SELECT first_name, last_name, active FROM profiles WHERE id = $1", profile_id
    )
    assert original is not None

    response = await client.post(
        "/api/v3/profile/update",
        json={
            "profileId": profile_id,
            "active": False,
        },
    )

    assert response.status_code == 200
    data = response.json()
    profile = data["profile"]

    # Only active should change
    assert profile["active"] is False
    # Other fields should remain unchanged
    assert profile["firstName"] == original["first_name"]
    assert profile["lastName"] == original["last_name"]


async def test_update_profile_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating non-existent profile."""
    fake_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/profile/update",
        json={
            "profileId": fake_id,
            "firstName": "Test",
        },
    )

    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()


async def test_update_profile_with_uuid(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating profile with actual UUID."""
    # Create a guest profile
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

    response = await client.post(
        "/api/v3/profile/update",
        json={
            "profileId": str(guest_id),
            "firstName": "UpdatedGuest",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["profile"]["id"] == str(guest_id)
    assert data["profile"]["firstName"] == "UpdatedGuest"


async def test_update_profile_last_active(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating profile with lastActive (should insert into profile_activity)."""
    profile_id = await get_superadmin_alias(db)

    from datetime import UTC, datetime

    last_active = datetime.now(UTC).isoformat()

    response = await client.post(
        "/api/v3/profile/update",
        json={
            "profileId": profile_id,
            "lastActive": last_active,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["profile"]["lastActive"] is not None

    # Verify activity was inserted
    activity = await db.fetchrow(
        "SELECT * FROM profile_activity WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 1",
        profile_id,
    )
    assert activity is not None
