"""Integration tests for scenario_tool_statement WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO

from app.socket.v3.scenarios.tools.statement import (
    _scenario_tool_problem_statement_impl,
    scenario_tool_problem_statement,
    scenario_tool_problem_statement_internal,
)

pytestmark = pytest.mark.asyncio


async def test_scenario_tool_statement_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful scenario_tool_statement event."""
    # Arrange
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )

    sid = "test_sid_123"
    data = {
        "trace_id": "test-trace-id",
        "title": "Test Problem Statement",
        "description": "This is a test problem statement description",
        "scenario_id": str(scenario_id),
    }

    # Act
    await scenario_tool_problem_statement(sid, data)

    # Assert - verify problem statement was created
    ps_row = await db.fetchrow(
        "SELECT * FROM problem_statements WHERE problem_statement_name = $1",
        "Test Problem Statement",
    )
    assert ps_row is not None
    assert ps_row["problem_statement"] == "This is a test problem statement description"
    assert ps_row["scenario_id"] == scenario_id

    # Verify event was emitted
    events = mock_sio.get_events("scenarios_tools_statement_complete")
    assert len(events) == 1
    assert events[0]["success"] is True
    assert events[0]["trace_id"] == "test-trace-id"


async def test_scenario_tool_statement_internal_event(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test scenario_tool_statement via internal event."""
    # Arrange
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )

    data = {
        "sid": "test_sid_123",
        "trace_id": "test-trace-id",
        "title": "Test Problem Statement",
        "description": "This is a test problem statement description",
        "scenario_id": str(scenario_id),
    }

    # Act
    await scenario_tool_problem_statement_internal(data)

    # Assert - verify problem statement was created
    ps_row = await db.fetchrow(
        "SELECT * FROM problem_statements WHERE problem_statement_name = $1",
        "Test Problem Statement",
    )
    assert ps_row is not None


async def test_scenario_tool_statement_missing_trace_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test scenario_tool_statement with missing trace_id."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "title": "Test Problem Statement",
        "description": "This is a test problem statement description",
    }

    # Act
    await scenario_tool_problem_statement(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("scenarios_tools_statement_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False

