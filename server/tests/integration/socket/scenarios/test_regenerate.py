"""Integration tests for regenerate_scenario WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)

from app.socket.v3.scenarios.regenerate import regenerate_scenario

pytestmark = pytest.mark.asyncio


async def test_regenerate_scenario_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful regenerate_scenario event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Create agent
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, active) VALUES ('Test Agent', true) RETURNING id"
    )

    # Create scenario with agent
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active, scenario_agent_id) VALUES ('Test Scenario', true, $1) RETURNING id",
        agent_id,
    )
    await db.execute(
        "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
        scenario_id,
    )

    sid = "test_sid_123"
    data = {
        "scenarioId": str(scenario_id),
        "userInstructions": "Make it more challenging",
        "departmentId": str(department_id),
        "profileId": profile_id,
        "objectivesEnabled": True,
    }

    # Act
    await regenerate_scenario(sid, data)

    # Assert - verify error was emitted (no previous run)
    # Handler requires a previous run for the scenario
    error_events = mock_sio.get_events("scenarios_regeneration_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert "previous run" in error_events[0]["message"].lower() or "no" in error_events[0]["message"].lower()


async def test_regenerate_scenario_missing_profile_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test regenerate_scenario with missing profile_id."""
    # Arrange
    department_id = await get_or_create_test_department(db)

    # Create scenario
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )

    sid = "test_sid_123"
    data = {
        "scenarioId": str(scenario_id),
        "userInstructions": "Make it more challenging",
        "departmentId": str(department_id),
    }

    # Act
    await regenerate_scenario(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("scenarios_regeneration_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert "profile" in error_events[0]["message"].lower()


async def test_regenerate_scenario_missing_scenario_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test regenerate_scenario with missing scenarioId."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    sid = "test_sid_123"
    data = {
        "userInstructions": "Make it more challenging",
        "departmentId": str(department_id),
        "profileId": profile_id,
    }

    # Act
    await regenerate_scenario(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("scenarios_regeneration_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False

