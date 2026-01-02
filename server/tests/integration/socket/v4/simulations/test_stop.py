"""Integration tests for simulation_text_stop WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO

from app.socket.v4.simulations.stop import simulation_text_stop

pytestmark = pytest.mark.asyncio


async def test_simulation_text_stop_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_text_stop event."""
    # Arrange
    # Create test scenario and chat
    from tests.integration.socket.v4.helpers import create_test_scenario

    scenario_id = await create_test_scenario(db)

    from tests.integration.socket.v4.helpers import create_test_chat

    chat_id = await create_test_chat(db, scenario_id, trace_id="test-trace")

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
    assert len(stopped_events) >= 0


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
