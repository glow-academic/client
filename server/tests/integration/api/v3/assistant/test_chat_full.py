"""Route tests for POST /api/v3/assistant/chats/full endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_assistant_chat_full(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting full assistant chat data."""
    profile_id = await get_superadmin_alias(db)

    # Create a test chat
    chat_id = await db.fetchval(
        "INSERT INTO assistant_chats(title, profile_id, trace_id) "
        "VALUES ('Test Chat', $1, 'test-trace-id') RETURNING id",
        profile_id,
    )

    # Create a test message
    message_id = await db.fetchval(
        "INSERT INTO assistant_messages(chat_id, role, content, completed) "
        "VALUES ($1, 'user', 'Hello', true) RETURNING id",
        chat_id,
    )

    # Create a test tool call
    tool_call_id = await db.fetchval(
        "INSERT INTO assistant_tool_calls(chat_id, tool_name, tool_type, tool_arguments, tool_result, completed) "
        "VALUES ($1, 'test_tool', 'read', '{}'::jsonb, '{}'::jsonb, true) RETURNING id",
        chat_id,
    )

    response = await client.post(
        "/api/v3/assistant/chats/full",
        json={"chatId": str(chat_id), "profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "chat" in data
    assert "messages" in data
    assert "toolCalls" in data
    assert "allChats" in data

    # Verify chat data
    assert data["chat"] is not None
    assert data["chat"]["id"] == str(chat_id)
    assert data["chat"]["title"] == "Test Chat"
    assert data["chat"]["profileId"] == profile_id

    # Verify messages
    assert isinstance(data["messages"], list)
    assert len(data["messages"]) >= 1
    message_found = any(msg["id"] == str(message_id) for msg in data["messages"])
    assert message_found is True

    test_message = next(msg for msg in data["messages"] if msg["id"] == str(message_id))
    assert "id" in test_message
    assert "createdAt" in test_message
    assert "updatedAt" in test_message
    assert "chatId" in test_message
    assert "role" in test_message
    assert "content" in test_message
    assert "completed" in test_message
    assert test_message["role"] == "user"
    assert test_message["content"] == "Hello"
    assert test_message["completed"] is True

    # Verify tool calls
    assert isinstance(data["toolCalls"], list)
    assert len(data["toolCalls"]) >= 1
    tool_call_found = any(tc["id"] == str(tool_call_id) for tc in data["toolCalls"])
    assert tool_call_found is True

    test_tool_call = next(
        tc for tc in data["toolCalls"] if tc["id"] == str(tool_call_id)
    )
    assert "id" in test_tool_call
    assert "createdAt" in test_tool_call
    assert "updatedAt" in test_tool_call
    assert "chatId" in test_tool_call
    assert "toolName" in test_tool_call
    assert "toolType" in test_tool_call
    assert "toolArguments" in test_tool_call
    assert "toolResult" in test_tool_call
    assert "completed" in test_tool_call
    assert test_tool_call["toolName"] == "test_tool"
    assert test_tool_call["toolType"] == "read"
    assert test_tool_call["completed"] is True

    # Verify allChats list
    assert isinstance(data["allChats"], list)
    assert len(data["allChats"]) >= 1


async def test_get_assistant_chat_full_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting full assistant chat data for non-existent chat."""
    profile_id = await get_superadmin_alias(db)
    fake_chat_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/assistant/chats/full",
        json={"chatId": fake_chat_id, "profileId": profile_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()


async def test_get_assistant_chat_full_empty(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting full assistant chat data with no messages or tool calls."""
    profile_id = await get_superadmin_alias(db)

    # Create a test chat with no messages or tool calls
    chat_id = await db.fetchval(
        "INSERT INTO assistant_chats(title, profile_id, trace_id) "
        "VALUES ('Empty Chat', $1, 'test-trace-id-2') RETURNING id",
        profile_id,
    )

    response = await client.post(
        "/api/v3/assistant/chats/full",
        json={"chatId": str(chat_id), "profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["chat"] is not None
    assert data["chat"]["id"] == str(chat_id)
    assert isinstance(data["messages"], list)
    assert len(data["messages"]) == 0
    assert isinstance(data["toolCalls"], list)
    assert len(data["toolCalls"]) == 0
