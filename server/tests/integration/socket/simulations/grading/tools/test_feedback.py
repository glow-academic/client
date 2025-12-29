"""Integration tests for grading_tool_feedback WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.simulations.grading.tools.feedback import (
    _grading_tool_feedback_impl,
    grading_tool_feedback,
    grading_tool_feedback_internal,
)

pytestmark = pytest.mark.asyncio


async def test_grading_tool_feedback_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful grading_tool_feedback event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create grade
    grade_id = await db.fetchval(
        "INSERT INTO grades(score, points, passed, active) VALUES (85, 100, true, true) RETURNING id"
    )

    # Create standard group
    standard_group_id = await db.fetchval(
        "INSERT INTO standard_groups(name, active) VALUES ('Test Group', true) RETURNING id"
    )

    chat_id = "test-chat-id"
    trace_id = "test-trace-id"
    sid = "test_sid_123"
    data = {
        "chat_id": chat_id,
        "trace_id": trace_id,
        "grade_id": str(grade_id),
        "standard_group_id": str(standard_group_id),
        "score": 85,
        "feedback": "Good work!",
        "profile_id": profile_id,
    }

    # Act
    feedback_id = await _grading_tool_feedback_impl(sid, data)

    # Assert - verify feedback was created
    assert feedback_id is not None
    feedback_row = await db.fetchrow(
        "SELECT * FROM feedbacks WHERE id = $1",
        feedback_id,
    )
    assert feedback_row is not None
    assert feedback_row["score"] == 85

    # Verify event was emitted
    events = mock_sio.get_events("grading_tools_feedback_complete")
    assert len(events) == 1
    assert events[0]["success"] is True
    assert events[0]["chat_id"] == chat_id
    assert events[0]["trace_id"] == trace_id


async def test_grading_tool_feedback_internal_event(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test grading_tool_feedback via internal event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    grade_id = await db.fetchval(
        "INSERT INTO grades(score, points, passed, active) VALUES (85, 100, true, true) RETURNING id"
    )
    standard_group_id = await db.fetchval(
        "INSERT INTO standard_groups(name, active) VALUES ('Test Group', true) RETURNING id"
    )

    data = {
        "sid": "test_sid_123",
        "chat_id": "test-chat-id",
        "trace_id": "test-trace-id",
        "grade_id": str(grade_id),
        "standard_group_id": str(standard_group_id),
        "score": 85,
        "feedback": "Good work!",
        "profile_id": profile_id,
    }

    # Act
    await grading_tool_feedback_internal(data)

    # Assert - verify feedback was created
    feedback_row = await db.fetchrow(
        "SELECT * FROM feedbacks WHERE grade_id = $1",
        grade_id,
    )
    assert feedback_row is not None


async def test_grading_tool_feedback_missing_required_fields(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test grading_tool_feedback with missing required fields."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "chat_id": "test-chat-id",
        "trace_id": "test-trace-id",
        # Missing grade_id, standard_group_id, etc.
    }

    # Act
    await grading_tool_feedback(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("grading_tools_feedback_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
