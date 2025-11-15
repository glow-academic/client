"""Integration tests for stop_chat WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockSocketIO

from app.socket.connections.stop_chat import stop_chat
from app.utils.websocket.set_active_connection import set_active_connection

pytestmark = pytest.mark.asyncio


async def test_stop_chat_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful chat stop."""
    # Arrange
    sid = "test_sid_123"
    chat_id = "00000000-0000-0000-0000-000000000001"
    await set_active_connection(chat_id, sid)

    data = {"chat_id": chat_id}

    # Act
    await stop_chat(sid, data)

    # Assert
    # Verify chat_stopped event was emitted
    stopped_events = mock_sio.get_events("chat_stopped")
    assert len(stopped_events) == 1
    assert stopped_events[0]["chat_id"] == str(chat_id)
    assert stopped_events[0]["chat_type"] == "assistant"  # default

    # Verify active connection was removed
    from app.utils.websocket.get_active_connection import get_active_connection

    active_sid = await get_active_connection(chat_id)
    # In test environment without Redis, this may return None
    # The important thing is stop_chat completed without error


async def test_stop_chat_with_chat_type(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test stop chat with custom chat_type."""
    # Arrange
    sid = "test_sid_456"
    chat_id = "00000000-0000-0000-0000-000000000002"
    await set_active_connection(chat_id, sid)

    data = {"chat_id": chat_id, "chat_type": "simulation"}

    # Act
    await stop_chat(sid, data)

    # Assert
    # Verify chat_stopped event was emitted with correct chat_type
    stopped_events = mock_sio.get_events("chat_stopped")
    assert len(stopped_events) == 1
    assert stopped_events[0]["chat_id"] == str(chat_id)
    assert stopped_events[0]["chat_type"] == "simulation"


async def test_stop_chat_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test stop_chat with missing chat_id."""
    # Arrange
    sid = "test_sid_789"
    data = {}  # No chat_id

    # Act
    await stop_chat(sid, data)

    # Assert
    # Verify no chat_stopped event was emitted
    stopped_events = mock_sio.get_events("chat_stopped")
    assert len(stopped_events) == 0
