"""Integration tests for scenario_tool_objectives WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO

from app.socket.v3.agents.scenario.tools.objective.call import (
    scenario_tool_objectives,
    scenario_tool_objectives_internal,
)

pytestmark = pytest.mark.asyncio


async def test_scenario_tool_objectives_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful scenario_tool_objectives event."""
    # Arrange
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )

    sid = "test_sid_123"
    data = {
        "trace_id": "test-trace-id",
        "objectives": [
            "Learn to solve differential equations",
            "Understand calculus concepts",
            "Apply mathematical principles",
        ],
        "scenario_id": str(scenario_id),
    }

    # Act
    await scenario_tool_objectives(sid, data)

    # Assert - verify objectives were created
    objectives = await db.fetch(
        "SELECT * FROM objectives WHERE scenario_id = $1 ORDER BY idx",
        scenario_id,
    )
    assert len(objectives) == 3

    # Verify event was emitted
    events = mock_sio.get_events("scenarios_tools_objectives_complete")
    assert len(events) == 1
    assert events[0]["success"] is True
    assert events[0]["trace_id"] == "test-trace-id"
    assert len(events[0]["objective_ids"]) == 3


async def test_scenario_tool_objectives_internal_event(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test scenario_tool_objectives via internal event."""
    # Arrange
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )

    data = {
        "sid": "test_sid_123",
        "trace_id": "test-trace-id",
        "objectives": ["Learn to solve problems"],
        "scenario_id": str(scenario_id),
    }

    # Act
    await scenario_tool_objectives_internal(data)

    # Assert - verify objective was created
    objectives = await db.fetch(
        "SELECT * FROM objectives WHERE scenario_id = $1",
        scenario_id,
    )
    assert len(objectives) == 1


async def test_scenario_tool_objectives_limits_to_3(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test scenario_tool_objectives limits to maximum 3 objectives."""
    # Arrange
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )

    sid = "test_sid_123"
    data = {
        "trace_id": "test-trace-id",
        "objectives": [
            "Objective 1",
            "Objective 2",
            "Objective 3",
            "Objective 4",  # Should be ignored
            "Objective 5",  # Should be ignored
        ],
        "scenario_id": str(scenario_id),
    }

    # Act
    await scenario_tool_objectives(sid, data)

    # Assert - verify only 3 objectives were created
    objectives = await db.fetch(
        "SELECT * FROM objectives WHERE scenario_id = $1",
        scenario_id,
    )
    assert len(objectives) == 3
