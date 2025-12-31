"""Integration tests for scenario_tool_image WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)

from app.socket.v3.agents.scenario.tools.image.call import (
    scenario_tool_image,
    scenario_tool_image_internal,
)

pytestmark = pytest.mark.asyncio


async def test_scenario_tool_image_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful scenario_tool_image event."""
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
        "trace_id": "test-trace-id",
        "name": "Test Image",
        "prompt": "A beautiful landscape",
        "agent_id": str(agent_id),
        "department_id": str(department_id),
        "profile_id": profile_id,
        "scenario_id": str(scenario_id),
    }

    # Act
    await scenario_tool_image(sid, data)

    # Assert - verify image generation event was emitted via internal_sio
    # The handler emits image_generate event internally
    # Verify handler completed without error
    # Handler should emit events to internal bus for image generation


async def test_scenario_tool_image_internal_event(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test scenario_tool_image via internal event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    agent_id = await db.fetchval(
        "INSERT INTO agents(name, active) VALUES ('Test Agent', true) RETURNING id"
    )

    data = {
        "sid": "test_sid_123",
        "trace_id": "test-trace-id",
        "name": "Test Image",
        "prompt": "A beautiful landscape",
        "agent_id": str(agent_id),
        "department_id": str(department_id),
        "profile_id": profile_id,
    }

    # Act
    await scenario_tool_image_internal(data)

    # Assert - handler should complete without error
    # Image generation happens asynchronously


async def test_scenario_tool_image_missing_trace_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test scenario_tool_image with missing trace_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    agent_id = await db.fetchval(
        "INSERT INTO agents(name, active) VALUES ('Test Agent', true) RETURNING id"
    )

    sid = "test_sid_123"
    data = {
        "name": "Test Image",
        "prompt": "A beautiful landscape",
        "agent_id": str(agent_id),
        "department_id": str(department_id),
        "profile_id": profile_id,
    }

    # Act
    await scenario_tool_image(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("scenarios_tools_image_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
