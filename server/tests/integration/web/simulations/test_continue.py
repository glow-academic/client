"""Integration tests for continue_simulation WebSocket event."""

import asyncpg  # type: ignore
import pytest
from app.web.simulations.continue import continue_simulation
from tests.integration.web.conftest import MockSocketIO

pytestmark = pytest.mark.asyncio


async def test_continue_simulation_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test continue_simulation with missing chat_id."""
    sid = "test_sid_123"
    data = {
        "attempt_id": "00000000-0000-0000-0000-000000000000",
    }

    await continue_simulation(sid, data)

    # Verify error was emitted
    error_events = mock_sio.get_events("simulation_error")
    assert len(error_events) >= 1
    assert "Missing chat_id" in error_events[0]["message"]


async def test_continue_simulation_missing_attempt_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test continue_simulation with missing attempt_id."""
    sid = "test_sid_123"
    data = {
        "chat_id": "00000000-0000-0000-0000-000000000000",
    }

    await continue_simulation(sid, data)

    # Verify error was emitted
    error_events = mock_sio.get_events("simulation_error")
    assert len(error_events) >= 1
    assert "Missing chat_id or attempt_id" in error_events[0]["message"]


async def test_continue_simulation_chat_not_found(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test continue_simulation with non-existent chat_id."""
    fake_chat_id = "00000000-0000-0000-0000-000000000000"
    fake_attempt_id = "00000000-0000-0000-0000-000000000001"

    sid = "test_sid_123"
    data = {
        "chat_id": fake_chat_id,
        "attempt_id": fake_attempt_id,
    }

    await continue_simulation(sid, data)

    # Verify error was emitted
    error_events = mock_sio.get_events("simulation_error")
    assert len(error_events) >= 1
    assert "Chat not found" in error_events[0]["message"]


async def test_continue_simulation_attempt_not_found(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test continue_simulation with non-existent attempt_id."""
    # Get an existing chat_id
    chat_row = await db.fetchrow(
        "SELECT id FROM simulation_chats LIMIT 1"
    )
    if not chat_row:
        pytest.skip("No simulation chats found in test database")
    chat_id = str(chat_row["id"])

    fake_attempt_id = "00000000-0000-0000-0000-000000000000"

    sid = "test_sid_123"
    data = {
        "chat_id": chat_id,
        "attempt_id": fake_attempt_id,
    }

    await continue_simulation(sid, data)

    # Verify error was emitted
    error_events = mock_sio.get_events("simulation_error")
    assert len(error_events) >= 1
    assert "Attempt not found" in error_events[0]["message"]

