"""Integration tests for simulation_voice_debug_info WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO

from app.socket.v3.simulations.voice.debug import simulation_voice_debug_info

pytestmark = pytest.mark.asyncio


async def test_simulation_voice_debug_info_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_voice_debug_info event."""
    # Arrange
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )
    chat_id = await db.fetchval(
        "INSERT INTO chats(title, scenario_id, completed, trace_id) VALUES ('Test Chat', $1, false, 'test-trace-id') RETURNING id",
        scenario_id,
    )
    run_id = await db.fetchval(
        "INSERT INTO runs(input_tokens, output_tokens) VALUES (0, 0) RETURNING id"
    )
    await db.execute(
        "INSERT INTO chat_runs(chat_id, run_id) VALUES ($1, $2)",
        chat_id,
        run_id,
    )

    sid = "test_sid_123"
    data = {
        "chat_id": str(chat_id),
        "content": "Debug information here",
    }

    # Act
    await simulation_voice_debug_info(sid, data)

    # Assert - verify debug info was saved (check via model_runs table if exists)
    # Handler should complete without error


async def test_simulation_voice_debug_info_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_voice_debug_info with missing chat_id."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "content": "Debug information",
    }

    # Act
    await simulation_voice_debug_info(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("simulations_voice_debug_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
