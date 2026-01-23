"""Integration tests for benchmark_run_start WebSocket event."""

import uuid

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.v4.helpers import (
    create_test_benchmark_attempt,
    create_test_eval_run,
    get_eval_by_active,
    get_or_create_test_department,
    get_or_create_test_model,
    get_or_create_test_profile,
)
from app.utils.sql_helper import execute_sql_typed

from app.infra.v4.websocket.set_socket_owner import set_socket_owner
from app.socket.v4.attempts.benchmark.run_start import benchmark_run_start

pytestmark = pytest.mark.asyncio


async def test_benchmark_run_start_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful benchmark run start."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    eval_id = await get_eval_by_active(db)
    if not eval_id:
        pytest.skip("No active evals found in test database")

    attempt_id = await create_test_benchmark_attempt(db, eval_id)
    run_id = await create_test_eval_run(db, eval_id, completed=False)

    data = {
        "attempt_id": str(attempt_id),
        "run_id": str(run_id),
    }

    # Act
    await benchmark_run_start(sid, data)

    # Assert - verify success event was emitted
    started_events = mock_sio.get_events("benchmarks_run_started")
    assert len(started_events) == 1
    assert started_events[0]["success"] is True
    assert started_events[0]["attempt_id"] == str(attempt_id)
    assert started_events[0]["run_id"] == str(run_id)

    # Verify benchmark_next was emitted internally
    next_events = mock_internal_sio.get_events("benchmark_next")
    assert len(next_events) == 1
    assert next_events[0]["attempt_id"] == str(attempt_id)
    assert next_events[0]["run_id"] == str(run_id)


async def test_benchmark_run_start_missing_attempt_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test benchmark_run_start with missing attempt_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    eval_id = await get_eval_by_active(db)
    if not eval_id:
        pytest.skip("No active evals found in test database")

    run_id = await create_test_eval_run(db, eval_id, completed=False)

    data = {
        "run_id": str(run_id),
    }

    # Act
    await benchmark_run_start(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("benchmarks_run_start_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert "attempt_id is required" in error_events[0]["message"]


async def test_benchmark_run_start_missing_run_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test benchmark_run_start with missing run_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    eval_id = await get_eval_by_active(db)
    if not eval_id:
        pytest.skip("No active evals found in test database")

    attempt_id = await create_test_benchmark_attempt(db, eval_id)

    data = {
        "attempt_id": str(attempt_id),
    }

    # Act
    await benchmark_run_start(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("benchmarks_run_start_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert "run_id is required" in error_events[0]["message"]


async def test_benchmark_run_start_attempt_not_found(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test benchmark_run_start with non-existent attempt_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    data = {
        "attempt_id": str(uuid.uuid4()),
        "run_id": str(uuid.uuid4()),
    }

    # Act
    await benchmark_run_start(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("benchmarks_run_start_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert "Attempt not found" in error_events[0]["message"]


async def test_benchmark_run_start_run_not_belongs_to_eval(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test benchmark_run_start with run that doesn't belong to eval."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    eval_id = await get_eval_by_active(db)
    if not eval_id:
        pytest.skip("No active evals found in test database")

    attempt_id = await create_test_benchmark_attempt(db, eval_id)

    # Create a run for a different eval (or no eval)
    from app.sql.types import TestCreateTestRunV4SqlParams

    run_params = TestCreateTestRunV4SqlParams(
        department_id=await get_or_create_test_department(db),
        model_id=await get_or_create_test_model(db),
    )

    run_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/socket/helpers/test_create_test_run_v4_complete.sql",
        params=run_params,
    )
    unrelated_run_id = str(run_result.run_id)

    data = {
        "attempt_id": str(attempt_id),
        "run_id": unrelated_run_id,
    }

    # Act
    await benchmark_run_start(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("benchmarks_run_start_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert "does not belong to this eval" in error_events[0]["message"]


async def test_benchmark_run_start_already_completed(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test benchmark_run_start with already completed run."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    eval_id = await get_eval_by_active(db)
    if not eval_id:
        pytest.skip("No active evals found in test database")

    attempt_id = await create_test_benchmark_attempt(db, eval_id)
    run_id = await create_test_eval_run(db, eval_id, completed=True)

    data = {
        "attempt_id": str(attempt_id),
        "run_id": str(run_id),
    }

    # Act
    await benchmark_run_start(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("benchmarks_run_start_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert "already completed" in error_events[0]["message"]


async def test_benchmark_run_start_invalid_uuid(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test benchmark_run_start with invalid UUID format."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    data = {
        "attempt_id": "invalid-uuid",
        "run_id": "invalid-uuid",
    }

    # Act
    await benchmark_run_start(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("benchmarks_run_start_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
