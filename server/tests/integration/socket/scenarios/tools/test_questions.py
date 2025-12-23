"""Integration tests for scenario_tool_questions WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO

from app.socket.v3.scenarios.tools.questions import (
    _scenario_tool_questions_impl,
    scenario_tool_questions,
    scenario_tool_questions_internal,
)

pytestmark = pytest.mark.asyncio


async def test_scenario_tool_questions_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful scenario_tool_questions event."""
    # Arrange
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )

    sid = "test_sid_123"
    data = {
        "trace_id": "test-trace-id",
        "questions": [
            {
                "question_text": "What is 2+2?",
                "allow_multiple": False,
                "options": [
                    {"option_text": "3", "is_correct": False},
                    {"option_text": "4", "is_correct": True},
                    {"option_text": "5", "is_correct": False},
                ],
            }
        ],
        "scenario_id": str(scenario_id),
    }

    # Act
    await scenario_tool_questions(sid, data)

    # Assert - verify questions were created
    questions = await db.fetch(
        "SELECT q.* FROM questions q JOIN scenario_questions sq ON sq.question_id = q.id WHERE sq.scenario_id = $1",
        scenario_id,
    )
    assert len(questions) == 1

    # Verify event was emitted
    events = mock_sio.get_events("scenarios_tools_questions_complete")
    assert len(events) == 1
    assert events[0]["success"] is True
    assert events[0]["trace_id"] == "test-trace-id"
    assert len(events[0]["question_ids"]) == 1


async def test_scenario_tool_questions_internal_event(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test scenario_tool_questions via internal event."""
    # Arrange
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )

    data = {
        "sid": "test_sid_123",
        "trace_id": "test-trace-id",
        "questions": [
            {
                "question_text": "What is 2+2?",
                "allow_multiple": False,
                "options": [
                    {"option_text": "4", "is_correct": True},
                ],
            }
        ],
        "scenario_id": str(scenario_id),
    }

    # Act
    await scenario_tool_questions_internal(data)

    # Assert - verify question was created
    questions = await db.fetch(
        "SELECT q.* FROM questions q JOIN scenario_questions sq ON sq.question_id = q.id WHERE sq.scenario_id = $1",
        scenario_id,
    )
    assert len(questions) == 1


async def test_scenario_tool_questions_missing_scenario_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test scenario_tool_questions with missing scenario_id."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "trace_id": "test-trace-id",
        "questions": [
            {
                "question_text": "What is 2+2?",
                "allow_multiple": False,
                "options": [{"option_text": "4", "is_correct": True}],
            }
        ],
    }

    # Act
    await scenario_tool_questions(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("scenarios_tools_questions_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False

