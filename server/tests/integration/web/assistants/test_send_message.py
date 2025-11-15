"""Integration tests for send_assistant_message WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.web.conftest import MockSocketIO
from tests.seed_helpers import get_superadmin_alias  # type: ignore

from app.web.assistants.send_message import send_assistant_message

pytestmark = pytest.mark.asyncio


async def test_send_assistant_message_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test send_assistant_message with missing chat_id."""
    dept_row = await db.fetchrow(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    if not dept_row:
        pytest.skip("No active departments found in test database")
    department_id = str(dept_row["id"])

    sid = "test_sid_123"
    data = {
        "message": "Hello",
        "department_id": department_id,
    }

    await send_assistant_message(sid, data)

    # Verify error was emitted
    error_events = mock_sio.get_events("assistant_error")
    assert len(error_events) >= 1
    assert "Missing chat_id or message" in error_events[0]["message"]


async def test_send_assistant_message_missing_message(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test send_assistant_message with missing message."""
    dept_row = await db.fetchrow(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    if not dept_row:
        pytest.skip("No active departments found in test database")
    department_id = str(dept_row["id"])

    sid = "test_sid_123"
    data = {
        "chat_id": "00000000-0000-0000-0000-000000000000",
        "department_id": department_id,
    }

    await send_assistant_message(sid, data)

    # Verify error was emitted
    error_events = mock_sio.get_events("assistant_error")
    assert len(error_events) >= 1
    assert "Missing chat_id or message" in error_events[0]["message"]


async def test_send_assistant_message_missing_department_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test send_assistant_message with missing department_id."""
    profile_id = await get_superadmin_alias(db)

    # Create a test chat
    chat_id = await db.fetchval(
        "INSERT INTO assistant_chats(title, profile_id, trace_id) "
        "VALUES ('Test Chat', $1, 'test-trace-id') RETURNING id",
        profile_id,
    )
    chat_id_str = str(chat_id)

    sid = "test_sid_123"
    data = {
        "chat_id": chat_id_str,
        "message": "Hello",
    }

    await send_assistant_message(sid, data)

    # Verify error was emitted
    error_events = mock_sio.get_events("assistant_error")
    assert len(error_events) >= 1
    assert "Missing department_id" in error_events[0]["message"]


async def test_send_assistant_message_chat_not_found(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test send_assistant_message with non-existent chat_id."""
    fake_chat_id = "00000000-0000-0000-0000-000000000000"

    dept_row = await db.fetchrow(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    if not dept_row:
        pytest.skip("No active departments found in test database")
    department_id = str(dept_row["id"])

    sid = "test_sid_123"
    data = {
        "chat_id": fake_chat_id,
        "message": "Hello",
        "department_id": department_id,
    }

    await send_assistant_message(sid, data)

    # Verify error was emitted (either from handler or from process function)
    error_events = mock_sio.get_events("assistant_error")
    assert len(error_events) >= 1


@pytest.mark.skip(reason="Requires OpenAI monkeypatching - will be enabled after mocking setup")
async def test_send_assistant_message_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful message processing.

    This test requires OpenAI to be properly monkeypatched.
    It will verify:
    - User message is created and emitted
    - Assistant message tokens are streamed
    - Message completion event is emitted
    """
    profile_id = await get_superadmin_alias(db)

    dept_row = await db.fetchrow(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    if not dept_row:
        pytest.skip("No active departments found in test database")
    department_id = str(dept_row["id"])

    # Create a test chat
    chat_id = await db.fetchval(
        "INSERT INTO assistant_chats(title, profile_id, trace_id) "
        "VALUES ('Test Chat', $1, 'test-trace-id') RETURNING id",
        profile_id,
    )
    chat_id_str = str(chat_id)

    sid = "test_sid_123"
    data = {
        "chat_id": chat_id_str,
        "message": "Hello, assistant",
        "department_id": department_id,
    }

    await send_assistant_message(sid, data)

    # Verify user message was emitted
    new_message_events = mock_sio.get_events("assistant_new_message")
    assert len(new_message_events) >= 1
    user_message = next(
        (msg for msg in new_message_events if msg["role"] == "user"), None
    )
    assert user_message is not None
    assert user_message["content"] == "Hello, assistant"
    assert user_message["completed"] is True

    # Verify assistant message tokens were emitted (if OpenAI is mocked)
    token_events = mock_sio.get_events("assistant_message_token")
    # This will be empty until OpenAI is properly mocked

    # Verify message completion was emitted (if OpenAI is mocked)
    complete_events = mock_sio.get_events("assistant_message_complete")
    # This will be empty until OpenAI is properly mocked


@pytest.mark.skip(reason="Requires OpenAI monkeypatching - will be enabled after mocking setup")
async def test_send_assistant_message_tool_calls(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test message processing with tool calls.

    This test requires OpenAI to be properly monkeypatched to simulate tool calls.
    It will verify:
    - Tool call created events are emitted
    - Tool call completed events are emitted
    """
    profile_id = await get_superadmin_alias(db)

    dept_row = await db.fetchrow(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    if not dept_row:
        pytest.skip("No active departments found in test database")
    department_id = str(dept_row["id"])

    # Create a test chat
    chat_id = await db.fetchval(
        "INSERT INTO assistant_chats(title, profile_id, trace_id) "
        "VALUES ('Test Chat', $1, 'test-trace-id') RETURNING id",
        profile_id,
    )
    chat_id_str = str(chat_id)

    sid = "test_sid_123"
    data = {
        "chat_id": chat_id_str,
        "message": "Create a new persona",
        "department_id": department_id,
    }

    await send_assistant_message(sid, data)

    # Verify tool call events were emitted (if OpenAI is mocked to return tool calls)
    tool_call_created = mock_sio.get_events("tool_call_created")
    tool_call_completed = mock_sio.get_events("tool_call_completed")
    # These will be empty until OpenAI is properly mocked

