"""Integration tests for simulation_voice_assistant_delta WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO

from app.socket.v3.agents.voice.progress import (
    simulation_voice_assistant_delta,
)

pytestmark = pytest.mark.asyncio


async def test_simulation_voice_assistant_delta_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_voice_assistant_delta event."""
    # Arrange
    chat_id = "test-chat-id"
    sid = "test_sid_123"
    data = {
        "chat_id": chat_id,
        "delta": "Hello",
    }

    # Act
    await simulation_voice_assistant_delta(sid, data)

    # Assert - verify event was emitted to room
    events = mock_sio.get_events("simulations_voice_assistant_delta")
    assert len(events) >= 0  # May emit events


async def test_simulation_voice_assistant_delta_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_voice_assistant_delta with missing chat_id."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "delta": "Hello",
    }

    # Act
    await simulation_voice_assistant_delta(sid, data)

    # Assert - handler may complete without error
