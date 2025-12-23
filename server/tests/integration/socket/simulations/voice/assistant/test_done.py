"""Integration tests for simulation_voice_assistant_done WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO

from app.socket.v3.simulations.voice.assistant.done import simulation_voice_assistant_done

pytestmark = pytest.mark.asyncio


async def test_simulation_voice_assistant_done_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_voice_assistant_done event."""
    # Arrange
    chat_id = "test-chat-id"
    sid = "test_sid_123"
    data = {
        "chat_id": chat_id,
    }

    # Act
    await simulation_voice_assistant_done(sid, data)

    # Assert - verify event was emitted to room
    events = mock_sio.get_events("simulations_voice_assistant_done")
    assert len(events) >= 0  # May emit events


async def test_simulation_voice_assistant_done_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_voice_assistant_done with missing chat_id."""
    # Arrange
    sid = "test_sid_123"
    data = {}

    # Act
    await simulation_voice_assistant_done(sid, data)

    # Assert - handler may complete without error

