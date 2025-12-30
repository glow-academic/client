"""Integration tests for practice mode in simulation_start WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)

from app.socket.v3.simulations.start import simulation_start

pytestmark = pytest.mark.asyncio


async def test_simulation_text_practice_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful practice mode in simulation_start event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Create persona
    persona_id = await db.fetchval(
        "INSERT INTO personas(name, active) VALUES ('Test Persona', true) RETURNING id"
    )

    # Create practice simulation
    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) "
        "VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
    )

    simulation_id = await db.fetchval(
        "INSERT INTO simulations(title, description, active, practice_simulation, time_limit, rubric_id) "
        "VALUES ('Practice Simulation', 'Test', true, true, 60, $1) RETURNING id",
        rubric_id,
    )

    await db.execute(
        "INSERT INTO simulation_departments(simulation_id, department_id, active) "
        "VALUES ($1, $2, true)",
        simulation_id,
        department_id,
    )

    # Create scenario and link persona to scenario (required for practice mode)
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )
    
    await db.execute(
        "INSERT INTO scenario_personas(scenario_id, persona_id, active) "
        "VALUES ($1, $2, true)",
        scenario_id,
        persona_id,
    )

    await db.execute(
        "INSERT INTO simulation_scenarios(simulation_id, scenario_id, position, active) "
        "VALUES ($1, $2, 1, true)",
        simulation_id,
        scenario_id,
    )

    sid = "test_sid_123"
    data = {
        "practice_mode": True,
        "practice_persona_id": str(persona_id),
        "practice_department_id": str(department_id),
        "profile_id": str(profile_id),
    }

    # Act
    await simulation_start(sid, data)

    # Assert - verify attempt was created
    attempt_row = await db.fetchrow(
        "SELECT * FROM simulation_attempts WHERE simulation_id = $1 ORDER BY created_at DESC LIMIT 1",
        simulation_id,
    )
    assert attempt_row is not None


async def test_simulation_text_practice_missing_profile_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test practice mode in simulation_start with missing profile_id."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "practice_mode": True,
        "practice_persona_id": "00000000-0000-0000-0000-000000000000",
    }

    # Act
    await simulation_start(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("simulations_start_error")
    assert len(error_events) >= 1
