"""Integration tests for stop_simulation WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockSocketIO

from app.socket.v3.simulations.text.stop import simulation_text_stop

pytestmark = pytest.mark.asyncio


async def test_stop_simulation_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test stop_simulation with missing chat_id."""
    sid = "test_sid_123"
    data = {}

    await simulation_text_stop(sid, data)

    # Verify error was emitted
    error_events = mock_sio.get_events("simulations_text_stop_error")
    assert len(error_events) >= 1

    # Verify no stop event was emitted
    stopped_events = mock_sio.get_events("simulations_text_stopped")
    assert len(stopped_events) == 0


async def test_stop_simulation_chat_not_found(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test stop_simulation with non-existent chat_id."""
    fake_chat_id = "00000000-0000-0000-0000-000000000000"

    sid = "test_sid_123"
    data = {
        "chat_id": fake_chat_id,
    }

    await simulation_text_stop(sid, data)

    # Should emit stop event
    stopped_events = mock_sio.get_events("simulations_text_stopped")
    assert len(stopped_events) >= 1


async def test_stop_simulation_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test stop_simulation with valid chat_id (may not have active run)."""
    # Create test data: get a scenario_id
    scenario_row = await db.fetchrow(
        "SELECT id FROM scenarios WHERE active = true LIMIT 1"
    )
    if not scenario_row:
        pytest.skip("No active scenarios found in test database")
    scenario_id = scenario_row["id"]

    # Create a simulation_chat
    chat_id = await db.fetchval(
        "INSERT INTO simulation_chats (title, scenario_id, completed, trace_id) "
        "VALUES ('Test Chat', $1, false, 'test-trace-id') RETURNING id",
        scenario_id,
    )
    chat_id_str = str(chat_id)

    sid = "test_sid_123"
    data = {
        "chat_id": chat_id_str,
    }

    await simulation_text_stop(sid, data)

    # Should emit stop event (may be success=False if no active run)
    stopped_events = mock_sio.get_events("simulations_text_stopped")
    assert len(stopped_events) >= 1
    assert "chat_id" in stopped_events[0]
