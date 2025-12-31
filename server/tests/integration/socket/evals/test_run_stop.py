"""Integration tests for eval_run_stop WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

# TODO: eval_run_stop may have been removed or renamed - verify actual location
# from app.socket.v3.benchmark import eval_run_stop

pytestmark = pytest.mark.asyncio


async def test_eval_run_stop_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful eval_run_stop event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create eval and attempt
    eval_id = await db.fetchval(
        "INSERT INTO evals(name, description, active) VALUES ('Test Eval', 'Test Description', true) RETURNING id"
    )
    attempt_id = await db.fetchval(
        "INSERT INTO eval_attempts(eval_id) VALUES ($1) RETURNING id",
        eval_id,
    )

    # Create run
    run_id = await db.fetchval(
        "INSERT INTO runs(input_tokens, output_tokens) VALUES (0, 0) RETURNING id"
    )

    # Create test with trace_id matching eval pattern
    test_id = await db.fetchval(
        "INSERT INTO tests(title, trace_id, run_id, completed) VALUES ('Test Title', $1, $2, false) RETURNING id",
        f"eval_{attempt_id}_{run_id}",
        run_id,
    )

    # Link test to attempt
    await db.execute(
        "INSERT INTO attempt_tests(attempt_id, test_id) VALUES ($1, $2)",
        attempt_id,
        test_id,
    )

    sid = "test_sid_123"
    data = {
        "attempt_id": str(attempt_id),
        "run_id": str(run_id),
    }

    # Act
    await eval_run_stop(sid, data)

    # Assert - verify test was marked as completed
    test_row = await db.fetchrow("SELECT completed FROM tests WHERE id = $1", test_id)
    assert test_row is not None
    assert test_row["completed"] is True

    # Verify eval_run was marked as completed
    eval_run_row = await db.fetchrow(
        "SELECT completed FROM eval_runs WHERE eval_id = $1 AND run_id = $2",
        eval_id,
        run_id,
    )
    assert eval_run_row is not None
    assert eval_run_row["completed"] is True

    # Verify event was emitted
    events = mock_sio.get_events("evals_run_stopped")
    assert len(events) == 1
    assert events[0]["attempt_id"] == str(attempt_id)
    assert events[0]["run_id"] == str(run_id)
    assert events[0]["success"] is True


async def test_eval_run_stop_missing_attempt_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test eval_run_stop with missing attempt_id."""
    # Arrange
    run_id = await db.fetchval(
        "INSERT INTO runs(input_tokens, output_tokens) VALUES (0, 0) RETURNING id"
    )

    sid = "test_sid_123"
    data = {
        "run_id": str(run_id),
    }

    # Act
    await eval_run_stop(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("evals_run_stop_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert (
        "attempt_id" in error_events[0]["message"].lower()
        or "missing" in error_events[0]["message"].lower()
    )


async def test_eval_run_stop_no_active_test(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test eval_run_stop with no active test."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create eval and attempt
    eval_id = await db.fetchval(
        "INSERT INTO evals(name, description, active) VALUES ('Test Eval', 'Test Description', true) RETURNING id"
    )
    attempt_id = await db.fetchval(
        "INSERT INTO eval_attempts(eval_id) VALUES ($1) RETURNING id",
        eval_id,
    )

    # Create run
    run_id = await db.fetchval(
        "INSERT INTO runs(input_tokens, output_tokens) VALUES (0, 0) RETURNING id"
    )

    sid = "test_sid_123"
    data = {
        "attempt_id": str(attempt_id),
        "run_id": str(run_id),
    }

    # Act
    await eval_run_stop(sid, data)

    # Assert - verify stopped event was emitted but with success=False
    events = mock_sio.get_events("evals_run_stopped")
    assert len(events) == 1
    assert events[0]["attempt_id"] == str(attempt_id)
    assert events[0]["run_id"] == str(run_id)
    assert events[0]["success"] is False
    assert (
        "active" in events[0]["message"].lower() or "no" in events[0]["message"].lower()
    )
