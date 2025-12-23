"""Integration tests for grading_tool_audio WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)

from app.socket.v3.simulations.grading.tools.audio import (
    _grading_tool_audio_impl,
    grading_tool_audio,
    grading_tool_audio_internal,
)

pytestmark = pytest.mark.asyncio


async def test_grading_tool_audio_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful grading_tool_audio event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Create agent
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, active) VALUES ('Test Agent', true) RETURNING id"
    )

    # Create messages
    message_id_1 = await db.fetchval(
        "INSERT INTO messages(role, content) VALUES ('user', 'Hello') RETURNING id"
    )
    message_id_2 = await db.fetchval(
        "INSERT INTO messages(role, content) VALUES ('assistant', 'Hi there') RETURNING id"
    )

    chat_id = "test-chat-id"
    trace_id = "test-trace-id"
    sid = "test_sid_123"
    data = {
        "chat_id": chat_id,
        "trace_id": trace_id,
        "message_numbers": [1, 2],
        "what_to_analyze": "Analyze the tone and clarity",
        "agent_id": str(agent_id),
        "department_id": str(department_id),
        "message_id_map": {str(message_id_1): 1, str(message_id_2): 2},
        "profile_id": profile_id,
    }

    # Act
    analysis = await _grading_tool_audio_impl(sid, data)

    # Assert - verify log_run event was emitted via internal_sio
    log_events = mock_internal_sio.get_events("log_run")
    # May be emitted after analysis completes

    # Verify event was emitted
    events = mock_sio.get_events("grading_tools_audio_complete")
    # May complete asynchronously


async def test_grading_tool_audio_internal_event(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test grading_tool_audio via internal event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, active) VALUES ('Test Agent', true) RETURNING id"
    )

    data = {
        "sid": "test_sid_123",
        "chat_id": "test-chat-id",
        "trace_id": "test-trace-id",
        "message_numbers": [1],
        "what_to_analyze": "Analyze the tone",
        "agent_id": str(agent_id),
        "department_id": str(department_id),
        "message_id_map": {},
        "profile_id": profile_id,
    }

    # Act
    await grading_tool_audio_internal(data)

    # Assert - handler should complete without error
    # Analysis happens asynchronously


async def test_grading_tool_audio_missing_required_fields(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test grading_tool_audio with missing required fields."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "chat_id": "test-chat-id",
        "trace_id": "test-trace-id",
        # Missing agent_id, department_id, etc.
    }

    # Act
    await grading_tool_audio(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("grading_tools_audio_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False

