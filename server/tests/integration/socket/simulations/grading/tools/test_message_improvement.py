"""Integration tests for grading_tool_message_improvement WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.simulations.grading.tools.message_improvement import (
    _grading_tool_message_improvement_impl,
    grading_tool_message_improvement,
    grading_tool_message_improvement_internal,
)

pytestmark = pytest.mark.asyncio


async def test_grading_tool_message_improvement_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful grading_tool_message_improvement event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create grade
    grade_id = await db.fetchval(
        "INSERT INTO grades(score, points, passed, active) VALUES (85, 100, true, true) RETURNING id"
    )

    # Create message
    message_id = await db.fetchval(
        "INSERT INTO messages(role, content) VALUES ('user', 'Hello') RETURNING id"
    )

    chat_id = "test-chat-id"
    trace_id = "test-trace-id"
    sid = "test_sid_123"
    data = {
        "chat_id": chat_id,
        "trace_id": trace_id,
        "grade_id": str(grade_id),
        "message_number": 1,
        "feedback": "Could be improved",
        "strike": [{"find": "Hello", "replace": "Hi"}],
        "message_id_map": {str(message_id): 1},
        "profile_id": profile_id,
    }

    # Act
    message_feedback_id = await _grading_tool_message_improvement_impl(sid, data)

    # Assert - verify message feedback was created
    assert message_feedback_id is not None
    feedback_row = await db.fetchrow(
        "SELECT * FROM message_feedbacks WHERE id = $1",
        message_feedback_id,
    )
    assert feedback_row is not None

    # Verify event was emitted
    events = mock_sio.get_events("grading_tools_message_improvement_complete")
    assert len(events) == 1
    assert events[0]["success"] is True
    assert events[0]["chat_id"] == chat_id


async def test_grading_tool_message_improvement_internal_event(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test grading_tool_message_improvement via internal event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    grade_id = await db.fetchval(
        "INSERT INTO grades(score, points, passed, active) VALUES (85, 100, true, true) RETURNING id"
    )
    message_id = await db.fetchval(
        "INSERT INTO messages(role, content) VALUES ('user', 'Hello') RETURNING id"
    )

    data = {
        "sid": "test_sid_123",
        "chat_id": "test-chat-id",
        "trace_id": "test-trace-id",
        "grade_id": str(grade_id),
        "message_number": 1,
        "feedback": "Could be improved",
        "message_id_map": {str(message_id): 1},
        "profile_id": profile_id,
    }

    # Act
    await grading_tool_message_improvement_internal(data)

    # Assert - verify message feedback was created
    feedback_row = await db.fetchrow(
        "SELECT * FROM message_feedbacks WHERE grade_id = $1",
        grade_id,
    )
    assert feedback_row is not None


async def test_grading_tool_message_improvement_missing_required_fields(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test grading_tool_message_improvement with missing required fields."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "chat_id": "test-chat-id",
        "trace_id": "test-trace-id",
        # Missing grade_id, message_number, etc.
    }

    # Act
    await grading_tool_message_improvement(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("grading_tools_message_improvement_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False

