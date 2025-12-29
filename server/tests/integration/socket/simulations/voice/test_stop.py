"""Integration tests for simulation_voice_stop WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO

from app.socket.v3.simulations.voice.stop import simulation_voice_stop

pytestmark = pytest.mark.asyncio


async def test_simulation_voice_stop_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_voice_stop event."""
    # Arrange
    chat_id = "test-chat-id"
    sid = "test_sid_123"
    data = {
        "chat_id": chat_id,
    }

    # Act
    await simulation_voice_stop(sid, data)

    # Assert - verify event was emitted
    events = mock_sio.get_events("simulations_voice_stop_response")
    assert len(events) == 1
    assert events[0]["success"] is True


async def test_simulation_voice_stop_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_voice_stop with missing chat_id."""
    # Arrange
    sid = "test_sid_123"
    data = {}

    # Act
    await simulation_voice_stop(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("simulations_voice_stop_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert (
        "chat_id" in error_events[0]["message"].lower()
        or "missing" in error_events[0]["message"].lower()
    )
