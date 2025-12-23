"""Integration tests for simulation_voice_user_speech WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO

from app.socket.v3.simulations.voice.user.speech import simulation_voice_user_speech

pytestmark = pytest.mark.asyncio


async def test_simulation_voice_user_speech_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_voice_user_speech event."""
    # Arrange
    chat_id = "test-chat-id"
    sid = "test_sid_123"
    data = {
        "chat_id": chat_id,
        "event_id": "test-event-id",
        "response_id": "test-response-id",
        "conversation_id": "test-conversation-id",
        "usage": {
            "input_token_details": {
                "audio_tokens": 10,
                "text_tokens": 5,
            },
            "output_token_details": {
                "audio_tokens": 8,
                "text_tokens": 3,
            },
            "input_tokens": 15,
            "output_tokens": 11,
        },
    }

    # Act
    await simulation_voice_user_speech(sid, data)

    # Assert - handler should complete without error
    # Creates runs for accumulated message IDs


async def test_simulation_voice_user_speech_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_voice_user_speech with missing chat_id."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "event_id": "test-event-id",
        "response_id": "test-response-id",
        "conversation_id": "test-conversation-id",
        "usage": {
            "input_token_details": {},
            "output_token_details": {},
            "input_tokens": 0,
            "output_tokens": 0,
        },
    }

    # Act
    await simulation_voice_user_speech(sid, data)

    # Assert - handler may complete without error (chat_id validation happens inside)
    # Verify handler doesn't crash

