"""Integration tests for simulation_enter WebSocket event."""

from datetime import UTC, datetime

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.simulations.enter import simulation_enter

pytestmark = pytest.mark.asyncio


async def test_simulation_enter_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_enter event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create scenario
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )

    # Create chat
    chat_id = await db.fetchval(
        "INSERT INTO chats(title, scenario_id, completed, trace_id) VALUES ('Test Chat', $1, false, 'test-trace-id') RETURNING id",
        scenario_id,
    )

    sid = "test_sid_123"
    created_at = datetime.now(UTC).isoformat()
    data = {
        "chat_id": str(chat_id),
        "created_at": created_at,
    }

    # Act
    await simulation_enter(sid, data)

    # Assert - verify chat created_at was updated
    chat_row = await db.fetchrow("SELECT created_at FROM chats WHERE id = $1", chat_id)
    assert chat_row is not None
    assert chat_row["created_at"] is not None

    # Verify event was emitted
    events = mock_sio.get_events("simulations_enter_response")
    assert len(events) == 1
    assert events[0]["success"] is True
    assert events[0]["chat_id"] == str(chat_id)


async def test_simulation_enter_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_enter with missing chat_id."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "created_at": datetime.now(UTC).isoformat(),
    }

    # Act
    await simulation_enter(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("simulations_enter_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert (
        "chat_id" in error_events[0]["message"].lower()
        or "missing" in error_events[0]["message"].lower()
    )


async def test_simulation_enter_invalid_created_at(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_enter with invalid created_at format."""
    # Arrange
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )
    chat_id = await db.fetchval(
        "INSERT INTO chats(title, scenario_id, completed, trace_id) VALUES ('Test Chat', $1, false, 'test-trace-id') RETURNING id",
        scenario_id,
    )

    sid = "test_sid_123"
    data = {
        "chat_id": str(chat_id),
        "created_at": "invalid-date-format",
    }

    # Act
    await simulation_enter(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("simulations_enter_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert (
        "format" in error_events[0]["message"].lower()
        or "invalid" in error_events[0]["message"].lower()
    )
