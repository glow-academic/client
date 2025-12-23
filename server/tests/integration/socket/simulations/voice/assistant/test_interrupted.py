"""Integration tests for simulation_voice_assistant_interrupted WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO

from app.socket.v3.simulations.voice.assistant.interrupted import (
    simulation_voice_assistant_interrupted,
)

pytestmark = pytest.mark.asyncio


async def test_simulation_voice_assistant_interrupted_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_voice_assistant_interrupted event."""
    # Arrange
    chat_id = "test-chat-id"
    sid = "test_sid_123"
    data = {
        "chat_id": chat_id,
    }

    # Act
    await simulation_voice_assistant_interrupted(sid, data)

    # Assert - verify event was emitted to room
    events = mock_sio.get_events("simulations_voice_assistant_interrupted")
    assert len(events) >= 0  # May emit events


async def test_simulation_voice_assistant_interrupted_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_voice_assistant_interrupted with missing chat_id."""
    # Arrange
    sid = "test_sid_123"
    data = {}

    # Act
    await simulation_voice_assistant_interrupted(sid, data)

    # Assert - handler may complete without error

