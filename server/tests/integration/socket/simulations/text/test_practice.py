"""Integration tests for simulation_text_practice WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)

from app.socket.v3.simulations.practice import simulation_text_practice

pytestmark = pytest.mark.asyncio


async def test_simulation_text_practice_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_text_practice event."""
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

    # Link persona to simulation
    await db.execute(
        "INSERT INTO simulation_personas(simulation_id, persona_id, active) "
        "VALUES ($1, $2, true)",
        simulation_id,
        persona_id,
    )

    sid = "test_sid_123"
    data = {
        "persona_id": str(persona_id),
        "department_id": str(department_id),
        "profile_id": str(profile_id),
    }

    # Act
    await simulation_text_practice(sid, data)

    # Assert - verify attempt was created
    attempt_row = await db.fetchrow(
        "SELECT * FROM simulation_attempts WHERE simulation_id = $1 AND profile_id = $2 ORDER BY created_at DESC LIMIT 1",
        simulation_id,
        profile_id,
    )
    assert attempt_row is not None


async def test_simulation_text_practice_missing_profile_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_text_practice with missing profile_id."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "persona_id": "00000000-0000-0000-0000-000000000000",
    }

    # Act
    await simulation_text_practice(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("simulations_text_practice_error")
    assert len(error_events) >= 1

