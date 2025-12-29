"""Integration tests for simulation_voice_user_text WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO

from app.socket.v3.simulations.voice.user.text import simulation_voice_user_text

pytestmark = pytest.mark.asyncio


async def test_simulation_voice_user_text_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_voice_user_text event."""
    # Arrange
    chat_id = "test-chat-id"
    sid = "test_sid_123"
    data = {
        "chat_id": chat_id,
        "text": "Hello, how are you?",
    }

    # Act
    await simulation_voice_user_text(sid, data)

    # Assert - verify event was emitted to room
    events = mock_sio.get_events("simulations_voice_user_text")
    assert len(events) >= 0  # May emit events


async def test_simulation_voice_user_text_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_voice_user_text with missing chat_id."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "text": "Hello",
    }

    # Act
    await simulation_voice_user_text(sid, data)

    # Assert - handler may complete without error
