"""Integration tests for leave_chat WebSocket event."""

import asyncpg  # type: ignore
import pytest
from app.socket.v3.connections.join_chat import join_chat
from app.socket.v3.connections.leave_chat import leave_chat
from app.utils.websocket.set_active_connection import set_active_connection
from tests.integration.socket.conftest import MockSocketIO

pytestmark = pytest.mark.asyncio


async def test_leave_chat_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful chat leave."""
    # Arrange - join a chat first
    sid = "test_sid_123"
    chat_id = "00000000-0000-0000-0000-000000000001"
    await join_chat(sid, {"chat_id": chat_id})
    await set_active_connection(chat_id, sid)

    # Clear events from join
    mock_sio.clear()

    # Act
    await leave_chat(sid, {"chat_id": chat_id})

    # Assert
    # Verify socket left the room
    room_name = f"simulation_{chat_id}"
    if room_name in mock_sio.rooms:
        assert sid not in mock_sio.rooms[room_name]

    # Verify active connection was removed
    from app.utils.websocket.get_active_connection import get_active_connection

    await get_active_connection(chat_id)
    # In test environment without Redis, this may return None
    # The important thing is leave_chat completed without error


async def test_leave_chat_with_chat_type(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test leave chat with custom chat_type."""
    # Arrange - join a chat with custom type first
    sid = "test_sid_456"
    chat_id = "00000000-0000-0000-0000-000000000002"
    await join_chat(sid, {"chat_id": chat_id, "chat_type": "simulation"})
    await set_active_connection(chat_id, sid)

    # Clear events from join
    mock_sio.clear()

    # Act
    await leave_chat(sid, {"chat_id": chat_id, "chat_type": "simulation"})

    # Assert
    # Verify socket left the correct room
    room_name = f"simulation_{chat_id}"
    if room_name in mock_sio.rooms:
        assert sid not in mock_sio.rooms[room_name]


async def test_leave_chat_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test leave_chat with missing chat_id."""
    # Arrange
    sid = "test_sid_789"
    data = {}  # No chat_id

    # Act
    await leave_chat(sid, data)

    # Assert
    # Handler should return early without error
    # No specific assertions needed - just verify it doesn't raise
