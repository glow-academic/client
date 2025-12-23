"""Integration tests for eval_run_start WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)
from utils.sql_helper import load_sql

from app.socket.v3.evals.run_start import eval_run_start

pytestmark = pytest.mark.asyncio


async def test_eval_run_start_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful eval_run_start event."""
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
    run_id = eval_row["run_id_1"]

    # Create attempt
    attempt_id = await db.fetchval(
        "INSERT INTO eval_attempts(eval_id) VALUES ($1) RETURNING id",
        eval_id,
    )

    # Link run to profile for department lookup
    await db.execute(
        "INSERT INTO run_profiles(run_id, profile_id, active) VALUES ($1, $2, true)",
        run_id,
        profile_id,
    )
    await db.execute(
        "INSERT INTO profile_departments(profile_id, department_id, active) VALUES ($1, $2, true)",
        profile_id,
        department_id,
    )

    sid = "test_sid_123"
    data = {
        "attempt_id": str(attempt_id),
        "run_id": run_id,
        "profile_id": profile_id,
    }

    # Act
    await eval_run_start(sid, data)

    # Assert - verify event was emitted
    events = mock_sio.get_events("evals_run_started")
    assert len(events) == 1
    assert events[0]["success"] is True
    assert events[0]["attempt_id"] == str(attempt_id)
    assert events[0]["run_id"] == run_id


async def test_eval_run_start_missing_attempt_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test eval_run_start with missing attempt_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    run_id = await db.fetchval(
        "INSERT INTO runs(input_tokens, output_tokens) VALUES (0, 0) RETURNING id"
    )

    sid = "test_sid_123"
    data = {
        "run_id": str(run_id),
        "profile_id": profile_id,
    }

    # Act
    await eval_run_start(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("evals_run_start_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert "attempt_id" in error_events[0]["message"].lower() or "missing" in error_events[0]["message"].lower()


async def test_eval_run_start_missing_run_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test eval_run_start with missing run_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    eval_id = await db.fetchval(
        "INSERT INTO evals(name, description, active) VALUES ('Test Eval', 'Test Description', true) RETURNING id"
    )
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
    await eval_run_start(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("evals_run_start_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert "run_id" in error_events[0]["message"].lower() or "missing" in error_events[0]["message"].lower()


async def test_eval_run_start_already_completed(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test eval_run_start with already completed run."""
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

    # Create eval
    eval_id = await db.fetchval(
        "INSERT INTO evals(name, description, active, agent_id, eval_agent_id, rubric_id) VALUES ('Test Eval', 'Test Description', true, $1, $2, $3) RETURNING id",
        agent_id,
        eval_agent_id,
        rubric_id,
    )

    # Create run and mark as completed
    run_id = await db.fetchval(
        "INSERT INTO runs(input_tokens, output_tokens) VALUES (0, 0) RETURNING id"
    )
    await db.execute(
        "INSERT INTO eval_runs(eval_id, run_id, completed) VALUES ($1, $2, true)",
        eval_id,
        run_id,
    )

    # Create attempt
    attempt_id = await db.fetchval(
        "INSERT INTO eval_attempts(eval_id) VALUES ($1) RETURNING id",
        eval_id,
    )

    sid = "test_sid_123"
    data = {
        "attempt_id": str(attempt_id),
        "run_id": str(run_id),
        "profile_id": profile_id,
    }

    # Act
    await eval_run_start(sid, data)

    # Assert - verify started event was emitted (idempotent - already completed)
    events = mock_sio.get_events("evals_run_started")
    assert len(events) == 1
    assert events[0]["success"] is True
    assert "already completed" in events[0]["message"].lower()

