"""Integration tests for stop_assistant WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockSocketIO
from tests.seed_helpers import get_superadmin_alias  # type: ignore

from app.socket.assistants.stop import stop_assistant

pytestmark = pytest.mark.asyncio


async def test_stop_assistant_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful assistant stop (even if no active run)."""
    profile_id = await get_superadmin_alias(db)

    # Create a test chat
    chat_id = await db.fetchval(
        "INSERT INTO assistant_chats(title, profile_id, trace_id) "
        "VALUES ('Test Chat', $1, 'test-trace-id') RETURNING id",
        profile_id,
    )
    chat_id_str = str(chat_id)

    sid = "test_sid_123"
    data = {"chat_id": chat_id_str}

    await stop_assistant(sid, data)

    # Verify stop event was emitted (even if no active run)
    stopped_events = mock_sio.get_events("assistant_stopped")
    assert len(stopped_events) == 1
    assert stopped_events[0]["chat_id"] == chat_id_str
    # Note: success may be False if no active run, which is still valid


async def test_stop_assistant_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test stop_assistant with missing chat_id."""
    sid = "test_sid_123"
    data = {}

    await stop_assistant(sid, data)

    # Verify error was emitted
    error_events = mock_sio.get_events("assistant_error")
    assert len(error_events) >= 1
    assert "Missing chat_id" in error_events[0]["message"]

    # Verify no stop event was emitted
    stopped_events = mock_sio.get_events("assistant_stopped")
    assert len(stopped_events) == 0


async def test_stop_assistant_chat_not_found(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test stop_assistant with non-existent chat_id."""
    fake_chat_id = "00000000-0000-0000-0000-000000000000"
    sid = "test_sid_123"
    data = {"chat_id": fake_chat_id}

    await stop_assistant(sid, data)

    # Verify error was emitted
    error_events = mock_sio.get_events("assistant_error")
    assert len(error_events) >= 1
    assert "Chat not found" in error_events[0]["message"]

    # Verify no stop event was emitted
    stopped_events = mock_sio.get_events("assistant_stopped")
    assert len(stopped_events) == 0


async def test_stop_assistant_no_active_run(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test stop_assistant when there's no active run (should still succeed)."""
    profile_id = await get_superadmin_alias(db)

    # Create a test chat
    chat_id = await db.fetchval(
        "INSERT INTO assistant_chats(title, profile_id, trace_id) "
        "VALUES ('Test Chat', $1, 'test-trace-id') RETURNING id",
        profile_id,
    )
    chat_id_str = str(chat_id)

    sid = "test_sid_123"
    data = {"chat_id": chat_id_str}

    await stop_assistant(sid, data)

    # Verify stop event was emitted (success may be False if no active run)
    stopped_events = mock_sio.get_events("assistant_stopped")
    assert len(stopped_events) == 1
    assert stopped_events[0]["chat_id"] == chat_id_str
    # The handler should still emit the event even if no active run was found
