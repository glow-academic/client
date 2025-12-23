"""Integration tests for eval_runs_start_all WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)
from utils.sql_helper import load_sql

from app.socket.v3.evals.runs_start_all import eval_runs_start_all

pytestmark = pytest.mark.asyncio


async def test_eval_runs_start_all_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful eval_runs_start_all event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Create agents
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, active) VALUES ('Test Agent', true) RETURNING id"
    )
    eval_agent_id = await db.fetchval(
        "INSERT INTO agents(name, active) VALUES ('Eval Agent', true) RETURNING id"
    )

    # Create rubric
    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
    )

    # Create eval with runs
    sql_create_eval = load_sql("tests/sql/integration/socket/create_test_eval_with_runs.sql")
    eval_row = await db.fetchrow(sql_create_eval, agent_id, eval_agent_id, rubric_id)
    assert eval_row is not None
    eval_id = eval_row["eval_id"]

    # Create attempt
    attempt_id = await db.fetchval(
        "INSERT INTO eval_attempts(eval_id) VALUES ($1) RETURNING id",
        eval_id,
    )

    sid = "test_sid_123"
    data = {
        "attempt_id": str(attempt_id),
        "profile_id": profile_id,
    }

    # Act
    await eval_runs_start_all(sid, data)

    # Assert - verify event was emitted
    events = mock_sio.get_events("evals_runs_start_all_started")
    assert len(events) == 1
    assert events[0]["success"] is True
    assert events[0]["attempt_id"] == str(attempt_id)
    assert events[0]["started_count"] == 2  # Two runs from create_test_eval_with_runs


async def test_eval_runs_start_all_missing_attempt_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test eval_runs_start_all with missing attempt_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    data = {
        "profile_id": profile_id,
    }

    # Act
    await eval_runs_start_all(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("evals_runs_start_all_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert "attempt_id" in error_events[0]["message"].lower() or "missing" in error_events[0]["message"].lower()


async def test_eval_runs_start_all_no_pending_runs(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test eval_runs_start_all with no pending runs."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create eval without runs
    eval_id = await db.fetchval(
        "INSERT INTO evals(name, description, active) VALUES ('Test Eval', 'Test Description', true) RETURNING id"
    )

    # Create attempt
    attempt_id = await db.fetchval(
        "INSERT INTO eval_attempts(eval_id) VALUES ($1) RETURNING id",
        eval_id,
    )

    sid = "test_sid_123"
    data = {
        "attempt_id": str(attempt_id),
        "profile_id": profile_id,
    }

    # Act
    await eval_runs_start_all(sid, data)

    # Assert - verify started event was emitted with count 0
    events = mock_sio.get_events("evals_runs_start_all_started")
    assert len(events) == 1
    assert events[0]["success"] is True
    assert events[0]["attempt_id"] == str(attempt_id)
    assert events[0]["started_count"] == 0

