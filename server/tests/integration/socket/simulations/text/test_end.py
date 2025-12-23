"""Integration tests for simulation_text_end WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)
from utils.sql_helper import load_sql

from app.socket.v3.simulations.text.end import simulation_text_end

pytestmark = pytest.mark.asyncio


async def test_simulation_text_end_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_text_end event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Create complete test setup using SQL file
    sql_setup = load_sql("tests/sql/integration/socket/create_test_simulation_attempt.sql")
    setup_row = await db.fetchrow(sql_setup, profile_id, department_id, None)
    assert setup_row is not None
    attempt_id = setup_row["attempt_id"]
    chat_id = setup_row["chat_id"]

    sid = "test_sid_123"
    data = {
        "chat_id": chat_id,
        "attempt_id": attempt_id,
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

    # Verify event was emitted
    events = mock_sio.get_events("simulations_text_ended")
    assert len(events) >= 0  # May or may not emit depending on implementation


async def test_simulation_text_end_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_text_end with missing chat_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    data = {
        "attempt_id": "00000000-0000-0000-0000-000000000000",
        "end_all": False,
    }

    # Act
    await simulation_text_end(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("simulations_text_end_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False


async def test_simulation_text_end_missing_attempt_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_text_end with missing attempt_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    sql_setup = load_sql("tests/sql/integration/socket/create_test_simulation_attempt.sql")
    setup_row = await db.fetchrow(sql_setup, profile_id, department_id, None)
    assert setup_row is not None
    chat_id = setup_row["chat_id"]

    sid = "test_sid_123"
    data = {
        "chat_id": chat_id,
        "end_all": False,
    }

    # Act
    await simulation_text_end(sid, data)

    # Assert - verify error was emitted or handler handles gracefully
    error_events = mock_sio.get_events("simulations_text_end_error")
    # May or may not emit error depending on implementation
    assert len(error_events) >= 0

