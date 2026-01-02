"""Integration tests for simulation_enter WebSocket event."""

from datetime import UTC, datetime

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO

from app.socket.v4.simulations.enter import simulation_enter

pytestmark = pytest.mark.asyncio


async def test_simulation_enter_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_enter event."""
    # Arrange
    # Create scenario
    from tests.integration.socket.v4.helpers import create_test_scenario

    scenario_id = await create_test_scenario(db)

    # Create chat
    from tests.integration.socket.v4.helpers import create_test_chat

    chat_id = await create_test_chat(db, scenario_id)

    sid = "test_sid_123"
    created_at = datetime.now(UTC).isoformat()
    data = {
        "chat_id": str(chat_id),
        "created_at": created_at,
    }

    # Act
    await simulation_enter(sid, data)

    # Assert - verify chat created_at was updated
    from tests.integration.socket.v4.helpers import get_chat_by_id

    chat_result = await get_chat_by_id(db, str(chat_id))
    assert chat_result is not None
    assert chat_result["created_at"] is not None
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


async def test_simulation_enter_invalid_created_at(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_enter with invalid created_at format."""
    # Arrange
    from tests.integration.socket.v4.helpers import create_test_scenario

    scenario_id = await create_test_scenario(db)
    from tests.integration.socket.v4.helpers import create_test_chat

    chat_id = await create_test_chat(db, scenario_id)

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
