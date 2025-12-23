"""Integration tests for simulation_text_end WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.simulations.text.end import simulation_text_end

pytestmark = pytest.mark.asyncio


async def test_simulation_text_end_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_text_end event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create test scenario and chat
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )
    await db.execute(
        "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
        scenario_id,
    )

    chat_id = await db.fetchval(
        "INSERT INTO simulation_chats(title, scenario_id, completed, trace_id) "
        "VALUES ('Test Chat', $1, false, 'test-trace') RETURNING id",
        scenario_id,
    )

    # Create attempt
    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) "
        "VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
    )
    simulation_id = await db.fetchval(
        "INSERT INTO simulations(title, description, active, practice_simulation, time_limit, rubric_id) "
        "VALUES ('Test Simulation', 'Test', true, false, 60, $1) RETURNING id",
        rubric_id,
    )

    attempt_id = await db.fetchval(
        "INSERT INTO simulation_attempts(simulation_id, profile_id, archived) "
        "VALUES ($1, $2, false) RETURNING id",
        simulation_id,
        profile_id,
    )

    await db.execute(
        "INSERT INTO attempt_chats(attempt_id, chat_id) VALUES ($1, $2)",
        attempt_id,
        chat_id,
    )

    sid = "test_sid_123"
    data = {
        "chat_id": str(chat_id),
        "attempt_id": str(attempt_id),
        "end_all": False,
    }

    # Act
    await simulation_text_end(sid, data)

    # Assert - verify chat was marked as completed
    chat_row = await db.fetchrow(
        "SELECT * FROM simulation_chats WHERE id = $1", chat_id
    )
    assert chat_row is not None
    # Chat should be marked as completed
    assert chat_row["completed"] is True

