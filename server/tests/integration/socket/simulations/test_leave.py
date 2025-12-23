"""Integration tests for simulation_leave WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.simulations.leave import simulation_leave

pytestmark = pytest.mark.asyncio


async def test_simulation_leave_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_leave event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create scenario
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )

    # Create chat
    chat_id = await db.fetchval(
        "INSERT INTO chats(title, scenario_id, completed, trace_id) VALUES ('Test Chat', $1, false, 'test-trace-id') RETURNING id",
        scenario_id,
    )

    # Join room first
    sid = "test_sid_123"
    room_name = f"assistant_{chat_id}"
    await mock_sio.enter_room(sid, room_name)

    data = {
        "chat_id": str(chat_id),
        "chat_type": "assistant",
    }

    # Act
    await simulation_leave(sid, data)

    # Assert - verify socket left room
    assert sid not in mock_sio.rooms.get(room_name, set())


async def test_simulation_leave_custom_chat_type(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_leave with custom chat_type."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )
    chat_id = await db.fetchval(
        "INSERT INTO chats(title, scenario_id, completed, trace_id) VALUES ('Test Chat', $1, false, 'test-trace-id') RETURNING id",
        scenario_id,
    )

    # Join room first
    sid = "test_sid_123"
    room_name = f"user_{chat_id}"
    await mock_sio.enter_room(sid, room_name)

    data = {
        "chat_id": str(chat_id),
        "chat_type": "user",
    }

    # Act
    await simulation_leave(sid, data)

    # Assert - verify socket left room
    assert sid not in mock_sio.rooms.get(room_name, set())


async def test_simulation_leave_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_leave with missing chat_id."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "chat_type": "assistant",
    }

    # Act
    await simulation_leave(sid, data)

    # Assert - verify handler completes (chat_id is optional)
    # Handler may not leave room if chat_id is empty

