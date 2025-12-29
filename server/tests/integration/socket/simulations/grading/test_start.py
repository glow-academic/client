"""Integration tests for simulation_grading_start WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.simulations.grading.start import simulation_grading_start

pytestmark = pytest.mark.asyncio


async def test_simulation_grading_start_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_grading_start event."""
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
        "INSERT INTO chats(title, scenario_id, completed, trace_id) "
        "VALUES ('Test Chat', $1, true, 'test-trace') RETURNING id",
        scenario_id,
    )

    sid = "test_sid_123"
    data = {
        "chat_id": str(chat_id),
        "profile_id": str(profile_id),
    }

    # Act
    await simulation_grading_start(sid, data)

    # Assert - verify handler completed
    # Grading start initiates grading process for completed chat
