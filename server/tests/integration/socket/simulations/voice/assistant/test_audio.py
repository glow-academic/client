"""Integration tests for simulation_voice_assistant_audio WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO

from app.socket.v3.simulations.voice.assistant.audio import simulation_voice_assistant_audio_link

pytestmark = pytest.mark.asyncio


async def test_simulation_voice_assistant_audio_link_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_voice_assistant_audio_link event."""
    # Arrange
    from tests.integration.socket.helpers import get_or_create_test_profile
    from utils.sql_helper import load_sql
    
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
        "INSERT INTO simulation_chats(title, scenario_id, completed, trace_id) "
        "VALUES ('Test Chat', $1, false, 'test-trace') RETURNING id",
        scenario_id,
    )
    
    # Create message
    message_id = await db.fetchval(
        "INSERT INTO messages(role, completed) VALUES ('assistant', true) RETURNING id"
    )
    
    # Create upload
    upload_id = await db.fetchval(
        "INSERT INTO uploads(filename, mime_type, size) "
        "VALUES ('test.mp3', 'audio/mpeg', 1024) RETURNING id"
    )
    
    sid = "test_sid_123"
    data = {
        "chat_id": str(chat_id),
        "message_id": str(message_id),
        "upload_id": str(upload_id),
    }

    # Act
    await simulation_voice_assistant_audio_link(sid, data)

    # Assert - verify error event was NOT emitted (success case)
    error_events = mock_sio.get_events("simulations_voice_assistant_audio_link_error")
    # Should not have errors if everything is valid
    assert len(error_events) == 0


async def test_simulation_voice_assistant_audio_link_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_voice_assistant_audio_link with missing chat_id."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "message_id": "00000000-0000-0000-0000-000000000000",
        "upload_id": "00000000-0000-0000-0000-000000000000",
    }

    # Act
    await simulation_voice_assistant_audio_link(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("simulations_voice_assistant_audio_link_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert "chat_id" in error_events[0]["message"].lower() or "missing" in error_events[0]["message"].lower()

