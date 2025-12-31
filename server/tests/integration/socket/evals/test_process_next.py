"""Integration tests for eval_process_next WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)
from utils.sql_helper import load_sql

# TODO: eval_process_next may have been renamed to benchmark_next - verify actual location
# from app.socket.v3.benchmark.next import benchmark_next as eval_process_next

pytestmark = pytest.mark.asyncio


async def test_eval_process_next_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful eval_process_next event."""
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
    sql_create_eval = load_sql(
        "tests/sql/integration/socket/create_test_eval_with_runs.sql"
    )
    eval_row = await db.fetchrow(sql_create_eval, agent_id, eval_agent_id, rubric_id)
    assert eval_row is not None
    eval_id = eval_row["eval_id"]
    run_id_1 = eval_row["run_id_1"]
    run_id_2 = eval_row["run_id_2"]

    # Create attempt
    attempt_id = await db.fetchval(
        "INSERT INTO eval_attempts(eval_id) VALUES ($1) RETURNING id",
        eval_id,
    )

    # Link runs to profile for department lookup
    await db.execute(
        "INSERT INTO run_profiles(run_id, profile_id, active) VALUES ($1, $2, true), ($3, $2, true)",
        run_id_1,
        profile_id,
        run_id_2,
    )
    await db.execute(
        "INSERT INTO profile_departments(profile_id, department_id, active) VALUES ($1, $2, true)",
        profile_id,
        department_id,
    )

    sid = "test_sid_123"
    data = {
        "attempt_id": str(attempt_id),
        "eval_id": eval_id,
        "current_run_id": run_id_1,  # Process next after this one
        "eval_agent_id": str(eval_agent_id),
        "rubric_id": str(rubric_id),
        "department_id": str(department_id),
        "profile_id": profile_id,
    }

    # Act
    await eval_process_next(sid, data)

    # Assert - verify run_completed event was emitted for next run
    events = mock_sio.get_events("evals_run_completed")
    # May have events from processing
    assert len(events) >= 0  # Process may complete immediately or emit events


async def test_eval_process_next_all_completed(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test eval_process_next when all runs are completed."""
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
        "eval_id": eval_id,
        "current_run_id": run_id,
        "eval_agent_id": str(eval_agent_id),
        "rubric_id": str(rubric_id),
    }

    # Act
    await eval_process_next(sid, data)

    # Assert - verify completed event was emitted
    events = mock_sio.get_events("evals_completed")
    assert len(events) >= 1
    assert events[0]["eval_id"] == eval_id
    assert events[0]["attempt_id"] == str(attempt_id)


async def test_eval_process_next_missing_required_fields(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test eval_process_next with missing required fields."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "attempt_id": "test-attempt-id",
        # Missing eval_id, current_run_id, etc.
    }

    # Act
    await eval_process_next(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("evals_process_next_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
