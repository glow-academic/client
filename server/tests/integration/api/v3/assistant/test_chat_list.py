"""Route tests for POST /api/v3/assistant/chats/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_assistant_chats_list(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting assistant chats list for a profile."""
    profile_id = await get_superadmin_alias(db)

    # Create a test chat
    chat_id = await db.fetchval(
        "INSERT INTO assistant_chats(title, profile_id, trace_id) "
        "VALUES ('Test Chat', $1, 'test-trace-id') RETURNING id",
        profile_id,
    )

    response = await client.post(
        "/api/v3/assistant/chats/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "allChats" in data
    assert isinstance(data["allChats"], list)
    assert len(data["allChats"]) >= 1

    # Verify the chat we created is in the list
    chat_found = any(chat["id"] == str(chat_id) for chat in data["allChats"])
    assert chat_found is True

    # Verify chat structure
    test_chat = next(chat for chat in data["allChats"] if chat["id"] == str(chat_id))
    assert "id" in test_chat
    assert "createdAt" in test_chat
    assert "updatedAt" in test_chat
    assert "profileId" in test_chat
    assert "title" in test_chat
    assert "traceId" in test_chat
    assert test_chat["title"] == "Test Chat"
    assert test_chat["profileId"] == profile_id


async def test_get_assistant_chats_list_empty(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting assistant chats list when no chats exist."""
    # Create a profile with no chats
    profile_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, alias, role, active) "
        "VALUES ('Test', 'User', 'testuser_nochats', 'guest', true) RETURNING id"
    )

    response = await client.post(
        "/api/v3/assistant/chats/list",
        json={"profileId": str(profile_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "allChats" in data
    assert isinstance(data["allChats"], list)
    assert len(data["allChats"]) == 0
