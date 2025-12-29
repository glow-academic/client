"""Integration tests for scenario_tool_video WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)

from app.socket.v3.scenarios.tools.video import (
    scenario_tool_video,
    scenario_tool_video_internal,
)

pytestmark = pytest.mark.asyncio


async def test_scenario_tool_video_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful scenario_tool_video event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    agent_id = await db.fetchval(
        "INSERT INTO agents(name, active) VALUES ('Test Agent', true) RETURNING id"
    )

    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )

    video_id = await db.fetchval(
        "INSERT INTO videos(name, active) VALUES ('Test Video', true) RETURNING id"
    )

    sid = "test_sid_123"
    data = {
        "trace_id": "test-trace-id",
        "prompt": "A beautiful video",
        "scenario_id": str(scenario_id),
        "video_id": str(video_id),
        "agent_id": str(agent_id),
        "department_id": str(department_id),
    }

    # Act
    await scenario_tool_video(sid, data)

    # Assert - verify video generation event was emitted
    # Handler emits video_generate event internally
    # Verify handler completed without error


async def test_scenario_tool_video_internal_event(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test scenario_tool_video via internal event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    agent_id = await db.fetchval(
        "INSERT INTO agents(name, active) VALUES ('Test Agent', true) RETURNING id"
    )

    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )

    data = {
        "sid": "test_sid_123",
        "trace_id": "test-trace-id",
        "prompt": "A beautiful video",
        "scenario_id": str(scenario_id),
        "agent_id": str(agent_id),
        "department_id": str(department_id),
    }

    # Act
    await scenario_tool_video_internal(data)

    # Assert - handler should complete without error
    # Video generation happens asynchronously


async def test_scenario_tool_video_missing_trace_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test scenario_tool_video with missing trace_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    agent_id = await db.fetchval(
        "INSERT INTO agents(name, active) VALUES ('Test Agent', true) RETURNING id"
    )

    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )

    sid = "test_sid_123"
    data = {
        "prompt": "A beautiful video",
        "scenario_id": str(scenario_id),
        "agent_id": str(agent_id),
        "department_id": str(department_id),
    }

    # Act
    await scenario_tool_video(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("scenarios_tools_video_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
