"""Integration tests for simulation_text_start WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)

from app.socket.v3.simulations.text.start import (
    simulation_text_start,
)

pytestmark = pytest.mark.asyncio


async def test_simulation_text_start_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_text_start event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Create test simulation with required dependencies
    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) "
        "VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
    )

    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )
    await db.execute(
        "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
        scenario_id,
    )

    simulation_id = await db.fetchval(
        "INSERT INTO simulations(title, description, active, practice_simulation, time_limit, rubric_id) "
        "VALUES ('Test Simulation', 'Test', true, false, 60, $1) RETURNING id",
        rubric_id,
    )

    await db.execute(
        "INSERT INTO simulation_departments(simulation_id, department_id, active) "
        "VALUES ($1, $2, true)",
        simulation_id,
        department_id,
    )

    await db.execute(
        "INSERT INTO simulation_scenarios(simulation_id, scenario_id, position, active) "
        "VALUES ($1, $2, 1, true)",
        simulation_id,
        scenario_id,
    )

    sid = "test_sid_123"
    data = {
        "simulation_id": str(simulation_id),
        "profile_id": str(profile_id),
    }

    # Act
    await simulation_text_start(sid, data)

    # Assert - verify attempt was created
    attempt_row = await db.fetchrow(
        "SELECT * FROM simulation_attempts WHERE simulation_id = $1 AND profile_id = $2 ORDER BY created_at DESC LIMIT 1",
        simulation_id,
        profile_id,
    )
    assert attempt_row is not None

    # Verify chat was created
    chat_row = await db.fetchrow(
        "SELECT sc.* FROM chats sc "
        "JOIN attempt_chats ac ON ac.chat_id = sc.id "
        "WHERE ac.attempt_id = $1",
        attempt_row["id"],
    )
    assert chat_row is not None

    # Verify event was emitted
    events = mock_sio.get_events("simulations_text_started")
    assert len(events) == 1
    assert events[0]["success"] is True
    assert "attempt_id" in events[0]


async def test_simulation_text_start_missing_simulation_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_text_start with missing simulation_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    data = {
        "profile_id": str(profile_id),
    }

    # Act
    await simulation_text_start(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("simulations_text_start_error")
    assert len(error_events) >= 1


async def test_simulation_text_start_infinite_mode(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_text_start with infinite mode."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) "
        "VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
    )

    simulation_id = await db.fetchval(
        "INSERT INTO simulations(title, description, active, practice_simulation, time_limit, rubric_id) "
        "VALUES ('Test Simulation', 'Test', true, false, 60, $1) RETURNING id",
        rubric_id,
    )

    await db.execute(
        "INSERT INTO simulation_departments(simulation_id, department_id, active) "
        "VALUES ($1, $2, true)",
        simulation_id,
        department_id,
    )

    sid = "test_sid_123"
    data = {
        "simulation_id": str(simulation_id),
        "profile_id": str(profile_id),
        "infinite": True,
        "infinite_time_limit": 120,
    }

    # Act
    await simulation_text_start(sid, data)

    # Assert - verify attempt was created with infinite_mode
    attempt_row = await db.fetchrow(
        "SELECT * FROM simulation_attempts WHERE simulation_id = $1 AND profile_id = $2 ORDER BY created_at DESC LIMIT 1",
        simulation_id,
        profile_id,
    )
    assert attempt_row is not None
    assert attempt_row["infinite_mode"] is True
