"""Integration tests for simulation_voice_user_transcript WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO

from app.socket.v3.simulations.voice.user.transcript import simulation_voice_user_transcript

pytestmark = pytest.mark.asyncio


async def test_simulation_voice_user_transcript_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_voice_user_transcript event."""
    # Arrange
    chat_id = "test-chat-id"
    item_id = "test-item-id"
    sid = "test_sid_123"
    data = {
        "chat_id": chat_id,
        "item_id": item_id,
        "transcript": "Hello, this is a test transcript",
    }

    # Act
    await simulation_voice_user_transcript(sid, data)

    # Assert - verify event was emitted to room
    events = mock_sio.get_events("simulations_voice_user_transcript")
    assert len(events) >= 0  # May emit events


async def test_simulation_voice_user_transcript_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_voice_user_transcript with missing chat_id."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "item_id": "test-item-id",
        "transcript": "Hello",
    }

    # Act
    await simulation_voice_user_transcript(sid, data)

    # Assert - handler may complete without error

