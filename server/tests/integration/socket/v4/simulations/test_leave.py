"""Integration tests for simulation_leave WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO

from app.socket.v4.simulations.leave import simulation_leave

pytestmark = pytest.mark.asyncio


async def test_simulation_leave_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_leave event."""
    # Arrange
    # Create scenario
    from tests.integration.socket.v4.helpers import create_test_scenario
    scenario_id = await create_test_scenario(db)

    # Create chat
    from tests.integration.socket.v4.helpers import create_test_chat
    chat_id = await create_test_chat(db, scenario_id)

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
    from tests.integration.socket.v4.helpers import create_test_scenario
    scenario_id = await create_test_scenario(db)
    from tests.integration.socket.v4.helpers import create_test_chat
    chat_id = await create_test_chat(db, scenario_id)

    # Join room first
    sid = "test_sid_123"
    room_name = f"simulation_{chat_id}"
    await mock_sio.enter_room(sid, room_name)

    data = {
        "chat_id": str(chat_id),
        "chat_type": "simulation",
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

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("simulations_leave_error")
    assert len(error_events) >= 1

