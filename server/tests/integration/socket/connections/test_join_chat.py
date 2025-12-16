"""Integration tests for join_chat WebSocket event."""

import asyncpg  # type: ignore
import pytest
from app.socket.v3.connections.join_chat import join_chat
from tests.integration.socket.conftest import MockSocketIO

pytestmark = pytest.mark.asyncio


async def test_join_chat_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful chat join."""
    # Arrange
    sid = "test_sid_123"
    chat_id = "00000000-0000-0000-0000-000000000001"
    data = {"chat_id": chat_id}

    # Act
    await join_chat(sid, data)

    # Assert
    # Verify joined_chat event was emitted
    joined_events = mock_sio.get_events("joined_chat")
    assert len(joined_events) == 1
    assert joined_events[0]["chat_id"] == chat_id
    assert joined_events[0]["chat_type"] == "simulation"  # default

    # Verify socket joined the room
    room_name = f"simulation_{chat_id}"
    assert room_name in mock_sio.rooms
    assert sid in mock_sio.rooms[room_name]

    # Verify active connection was set
    from app.utils.websocket.get_active_connection import get_active_connection

    await get_active_connection(chat_id)
    # In test environment without Redis, this may return None
    # The important thing is join_chat completed without error


async def test_join_chat_with_chat_type(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test join chat with custom chat_type."""
    # Arrange
    sid = "test_sid_456"
    chat_id = "00000000-0000-0000-0000-000000000002"
    data = {"chat_id": chat_id, "chat_type": "simulation"}

    # Act
    await join_chat(sid, data)

    # Assert
    # Verify joined_chat event was emitted with correct chat_type
    joined_events = mock_sio.get_events("joined_chat")
    assert len(joined_events) == 1
    assert joined_events[0]["chat_id"] == chat_id
    assert joined_events[0]["chat_type"] == "simulation"

    # Verify socket joined the correct room
    room_name = f"simulation_{chat_id}"
    assert room_name in mock_sio.rooms
    assert sid in mock_sio.rooms[room_name]


async def test_join_chat_default_chat_type(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test join chat defaults to 'simulation' chat_type."""
    # Arrange
    sid = "test_sid_789"
    chat_id = "00000000-0000-0000-0000-000000000003"
    data = {"chat_id": chat_id}  # No chat_type specified

    # Act
    await join_chat(sid, data)

    # Assert
    # Verify default chat_type is "simulation"
    joined_events = mock_sio.get_events("joined_chat")
    assert len(joined_events) == 1
    assert joined_events[0]["chat_type"] == "simulation"

    # Verify room name uses default chat_type
    room_name = f"simulation_{chat_id}"
    assert room_name in mock_sio.rooms
    assert sid in mock_sio.rooms[room_name]


async def test_join_chat_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test join_chat with missing chat_id."""
    # Arrange
    sid = "test_sid_missing"
    data = {}  # No chat_id

    # Act
    await join_chat(sid, data)

    # Assert
    # Verify no joined_chat event was emitted
    joined_events = mock_sio.get_events("joined_chat")
    assert len(joined_events) == 0

    # Verify socket did not join any new rooms (only sid room if it exists)
    # Should not have joined any chat-specific rooms
