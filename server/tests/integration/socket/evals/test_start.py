"""Integration tests for eval_start WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)
from utils.sql_helper import load_sql

from app.socket.v3.evals.start import eval_start

pytestmark = pytest.mark.asyncio


async def test_eval_start_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful eval_start event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Create eval with runs
    sql_create_eval = load_sql(
        "tests/sql/integration/socket/create_test_eval_with_runs.sql"
    )
    eval_row = await db.fetchrow(sql_create_eval, None, None, None)
    assert eval_row is not None
    eval_id = eval_row["eval_id"]

    sid = "test_sid_123"
    data = {
        "eval_id": eval_id,
        "profile_id": profile_id,
        "conversation_mode": False,
    }

    # Act
    await eval_start(sid, data)

    # Assert - verify attempt was created
    attempt_row = await db.fetchrow(
        "SELECT * FROM eval_attempts WHERE eval_id = $1 ORDER BY created_at DESC LIMIT 1",
        eval_id,
    )
    assert attempt_row is not None

    # Verify socket joined eval room
    attempt_id = str(attempt_row["id"])
    room_name = f"eval_{attempt_id}"
    assert room_name in mock_sio.rooms
    assert sid in mock_sio.rooms[room_name]

    # Verify event was emitted
    events = mock_sio.get_events("evals_started")
    assert len(events) == 1
    assert events[0]["success"] is True
    assert events[0]["attempt_id"] == attempt_id


async def test_eval_start_missing_eval_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test eval_start with missing eval_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    data = {
        "profile_id": profile_id,
    }

    # Act
    await eval_start(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("evals_start_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert (
        "eval_id" in error_events[0]["message"].lower()
        or "missing" in error_events[0]["message"].lower()
    )


async def test_eval_start_no_pending_runs(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test eval_start with eval that has no pending runs."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Create eval without runs
    eval_id = await db.fetchval(
        "INSERT INTO evals(name, description, active) VALUES ('Test Eval', 'Test Description', true) RETURNING id"
    )

    sid = "test_sid_123"
    data = {
        "eval_id": str(eval_id),
        "profile_id": profile_id,
    }

    # Act
    await eval_start(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("evals_start_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert (
        "pending" in error_events[0]["message"].lower()
        or "no" in error_events[0]["message"].lower()
    )


async def test_eval_start_with_conversation_mode(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test eval_start with conversation mode enabled."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Create agent for conversation
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, active) VALUES ('Test Agent', true) RETURNING id"
    )

    # Create eval with runs
    sql_create_eval = load_sql(
        "tests/sql/integration/socket/create_test_eval_with_runs.sql"
    )
    eval_row = await db.fetchrow(sql_create_eval, agent_id, None, None)
    assert eval_row is not None
    eval_id = eval_row["eval_id"]

    sid = "test_sid_123"
    data = {
        "eval_id": eval_id,
        "profile_id": profile_id,
        "conversation_mode": True,
        "conversation_agent_id": str(agent_id),
        "conversation_max_turns": 5,
    }

    # Act
    await eval_start(sid, data)

    # Assert - verify attempt was created with conversation mode
    attempt_row = await db.fetchrow(
        "SELECT * FROM eval_attempts WHERE eval_id = $1 ORDER BY created_at DESC LIMIT 1",
        eval_id,
    )
    assert attempt_row is not None
    assert attempt_row["conversation_mode"] is True
    assert attempt_row["conversation_agent_id"] == agent_id
    assert attempt_row["conversation_max_turns"] == 5

    # Verify event was emitted
    events = mock_sio.get_events("evals_started")
    assert len(events) == 1
    assert events[0]["success"] is True
