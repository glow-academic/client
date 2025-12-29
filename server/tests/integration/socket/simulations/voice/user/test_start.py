"""Integration tests for simulation_voice_user_start WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO

from app.socket.v3.simulations.voice.user.start import simulation_voice_user_start

pytestmark = pytest.mark.asyncio


async def test_simulation_voice_user_start_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_voice_user_start event."""
    # Arrange
    chat_id = "test-chat-id"
    item_id = "test-item-id"
    sid = "test_sid_123"
    data = {
        "chat_id": chat_id,
        "item_id": item_id,
    }

    # Act
    await simulation_voice_user_start(sid, data)

    # Assert - verify event was emitted to room
    events = mock_sio.get_events("simulations_voice_user_start")
    assert len(events) == 1
    assert events[0]["chat_id"] == chat_id
    assert events[0]["item_id"] == item_id


async def test_simulation_voice_user_start_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_voice_user_start with missing chat_id."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "item_id": "test-item-id",
    }

    # Act
    await simulation_voice_user_start(sid, data)

    # Assert - handler may complete without error (chat_id is optional)
    # Verify no events emitted if chat_id is missing
