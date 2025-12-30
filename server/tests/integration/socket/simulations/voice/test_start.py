"""Integration tests for simulation_voice_start WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.agents.simulation_voice.generate import simulation_voice_start

pytestmark = pytest.mark.asyncio


async def test_simulation_voice_start_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_voice_start event."""
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
        "VALUES ('Test Chat', $1, false, 'test-trace') RETURNING id",
        scenario_id,
    )

    sid = "test_sid_123"
    data = {
        "chat_id": str(chat_id),
        "profile_id": str(profile_id),
    }

    # Act
    await simulation_voice_start(sid, data)

    # Assert - verify handler completed
    # Voice start creates voice session and starts voice agent
    # Exact assertions depend on implementation
