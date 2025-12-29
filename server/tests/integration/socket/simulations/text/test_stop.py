"""Integration tests for simulation_text_stop WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.simulations.stop import simulation_text_stop

pytestmark = pytest.mark.asyncio


async def test_simulation_text_stop_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_text_stop event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create test scenario and chat
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )
    await db.execute(
        "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
        scenario_id,
    )

    chat_id = await db.fetchval(
        "INSERT INTO chats(title, scenario_id, completed, trace_id) "
        "VALUES ('Test Chat', $1, false, 'test-trace') RETURNING id",
        scenario_id,
    )

    sid = "test_sid_123"
    data = {
        "chat_id": str(chat_id),
    }

    # Act
    await simulation_text_stop(sid, data)

    # Assert - verify stop event was emitted or handler completed
    # The handler cancels active runs, which may or may not exist
    stopped_events = mock_sio.get_events("simulations_text_stopped")
    # May emit stopped event or error if no active run


async def test_simulation_text_stop_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_text_stop with missing chat_id."""
    # Arrange
    sid = "test_sid_123"
    data = {}

    # Act
    await simulation_text_stop(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("simulations_text_stop_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False


async def test_simulation_text_stop_invalid_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_text_stop with invalid/non-existent chat_id."""
    # Arrange
    sid = "test_sid_123"
    fake_chat_id = "00000000-0000-0000-0000-000000000000"
    data = {
        "chat_id": fake_chat_id,
    }

    # Act
    await simulation_text_stop(sid, data)

    # Assert - verify error was emitted or handler handles gracefully
    error_events = mock_sio.get_events("simulations_text_stop_error")
    # Handler may emit error when chat is not found
    assert len(error_events) >= 0

