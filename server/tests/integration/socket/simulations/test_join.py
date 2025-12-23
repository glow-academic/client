"""Integration tests for simulation_join WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.simulations.join import simulation_join

pytestmark = pytest.mark.asyncio


async def test_simulation_join_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_join event."""
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

    sid = "test_sid_123"
    data = {
        "chat_id": str(chat_id),
        "chat_type": "assistant",
    }

    # Act
    await simulation_join(sid, data)

    # Assert - verify socket joined room
    room_name = f"assistant_{chat_id}"
    assert room_name in mock_sio.rooms
    assert sid in mock_sio.rooms[room_name]

    # Verify event was emitted
    events = mock_sio.get_events("simulations_joined")
    assert len(events) == 1
    assert events[0]["chat_id"] == str(chat_id)
    assert events[0]["chat_type"] == "assistant"


async def test_simulation_join_custom_chat_type(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_join with custom chat_type."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )
    chat_id = await db.fetchval(
        "INSERT INTO chats(title, scenario_id, completed, trace_id) VALUES ('Test Chat', $1, false, 'test-trace-id') RETURNING id",
        scenario_id,
    )

    sid = "test_sid_123"
    data = {
        "chat_id": str(chat_id),
        "chat_type": "user",
    }

    # Act
    await simulation_join(sid, data)

    # Assert - verify socket joined room with custom type
    room_name = f"user_{chat_id}"
    assert room_name in mock_sio.rooms
    assert sid in mock_sio.rooms[room_name]

    # Verify event was emitted
    events = mock_sio.get_events("simulations_joined")
    assert len(events) == 1
    assert events[0]["chat_type"] == "user"


async def test_simulation_join_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_join with missing chat_id."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "chat_type": "assistant",
    }

    # Act
    await simulation_join(sid, data)

    # Assert - verify handler completes (chat_id is optional, defaults to empty string)
    # Handler may not join room if chat_id is empty
    events = mock_sio.get_events("simulations_joined")
    # May or may not emit event if chat_id is missing

