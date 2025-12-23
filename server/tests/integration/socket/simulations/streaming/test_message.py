"""Integration tests for simulation streaming message events."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.simulations.streaming.message import (
    simulation_message_start_internal,
    simulation_message_token_internal,
    simulation_message_complete_internal,
)

pytestmark = pytest.mark.asyncio


async def test_simulation_message_start_internal(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_message_start internal event."""
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

    data = {
        "chat_id": str(chat_id),
        "role": "assistant",
        "content": "",
        "completed": False,
        "sid": "test_sid_123",
    }

    # Act
    await simulation_message_start_internal(data)

    # Assert - verify message was created
    message_row = await db.fetchrow(
        "SELECT * FROM simulation_messages WHERE chat_id = $1 AND type = $2",
        chat_id,
        "response",
    )
    assert message_row is not None

