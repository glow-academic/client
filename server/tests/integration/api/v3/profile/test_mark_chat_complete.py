"""Route tests for POST /api/v3/profile/mark-chat-complete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_mark_chat_complete(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test marking chat as complete."""
    profile_id = await get_superadmin_alias(db)

    # Ensure viewed_chat is False initially
    await db.execute(
        "UPDATE profiles SET viewed_chat = false WHERE id = $1",
        profile_id,
    )

    response = await client.post(
        "/api/v3/profile/mark-chat-complete",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "chat marked complete" in data["message"].lower()

    # Verify in database
    profile = await db.fetchrow(
        "SELECT viewed_chat FROM profiles WHERE id = $1", profile_id
    )
    assert profile is not None
    assert profile["viewed_chat"] is True


async def test_mark_chat_complete_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test marking chat complete for non-existent profile."""
    fake_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/profile/mark-chat-complete",
        json={"profileId": fake_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()


async def test_mark_chat_complete_guest_profile_id(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test marking chat complete with guest-profile-id resolution."""
    # Create a default guest profile
    guest_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, email, role, default_profile, viewed_chat) "
        "VALUES('Guest', 'User', 'redacted@purdue.edu', 'guest', true, false) "
        "ON CONFLICT (email) DO UPDATE SET default_profile = true, viewed_chat = false "
        "RETURNING id"
    )

    response = await client.post(
        "/api/v3/profile/mark-chat-complete",
        json={"profileId": "guest-profile-id"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

    # Verify in database
    profile = await db.fetchrow(
        "SELECT viewed_chat FROM profiles WHERE id = $1", guest_id
    )
    assert profile is not None
    assert profile["viewed_chat"] is True
