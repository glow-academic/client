"""Integration tests for benchmark_runs_start_all WebSocket event."""

import uuid

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.v4.helpers import (
    create_test_benchmark_attempt,
    create_test_eval_group,
    create_test_eval_run,
    get_eval_by_active,
    get_or_create_test_profile,
)

from app.infra.v4.websocket.set_socket_owner import set_socket_owner
from app.socket.v4.attempts.benchmark.runs_start_all import benchmark_runs_start_all

pytestmark = pytest.mark.asyncio


async def test_benchmark_runs_start_all_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful benchmark runs start all."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    eval_id = await get_eval_by_active(db)
    if not eval_id:
        pytest.skip("No active evals found in test database")

    attempt_id = await create_test_benchmark_attempt(db, eval_id)
    # Create 2 pending runs
    run_id_1 = await create_test_eval_run(db, eval_id, completed=False)
    run_id_2 = await create_test_eval_run(db, eval_id, completed=False)

    data = {
        "attempt_id": str(attempt_id),
    }

    # Act
    await benchmark_runs_start_all(sid, data)

    # Assert - verify success event was emitted
    started_events = mock_sio.get_events("benchmarks_runs_start_all_started")
    assert len(started_events) == 1
    assert started_events[0]["success"] is True
    assert started_events[0]["attempt_id"] == str(attempt_id)
    assert started_events[0]["started_count"] == 2

    # Verify benchmark_next was emitted internally for each run
    next_events = mock_internal_sio.get_events("benchmark_next")
    assert len(next_events) == 2
    assert all(event["attempt_id"] == str(attempt_id) for event in next_events)
    assert all(event["eval_id"] == eval_id for event in next_events)


async def test_benchmark_runs_start_all_no_pending(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test benchmark_runs_start_all with no pending runs."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    eval_id = await get_eval_by_active(db)
    if not eval_id:
        pytest.skip("No active evals found in test database")

    attempt_id = await create_test_benchmark_attempt(db, eval_id)
    # Create completed runs (not pending)
    await create_test_eval_run(db, eval_id, completed=True)
    await create_test_eval_run(db, eval_id, completed=True)

    data = {
        "attempt_id": str(attempt_id),
    }

    # Act
    await benchmark_runs_start_all(sid, data)

    # Assert - verify success event was emitted with count 0
    started_events = mock_sio.get_events("benchmarks_runs_start_all_started")
    assert len(started_events) == 1
    assert started_events[0]["success"] is True
    assert started_events[0]["attempt_id"] == str(attempt_id)
    assert started_events[0]["started_count"] == 0

    # Verify no benchmark_next events were emitted
    next_events = mock_internal_sio.get_events("benchmark_next")
    assert len(next_events) == 0


async def test_benchmark_runs_start_all_with_groups(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test benchmark_runs_start_all with use_groups=true."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    eval_id = await get_eval_by_active(db)
    if not eval_id:
        pytest.skip("No active evals found in test database")

    # Update eval to use groups
    from utils.sql_helper import execute_sql_typed

    from app.sql.types import (
        TestUpdateEvalUseGroupsV4SqlParams,
    )

    update_params = TestUpdateEvalUseGroupsV4SqlParams(
        eval_id=uuid.UUID(eval_id), use_groups=True
    )
    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_update_eval_use_groups_v4_complete.sql",
        params=update_params,
    )

    attempt_id = await create_test_benchmark_attempt(db, eval_id)
    # Create 2 pending groups
    group_id_1 = await create_test_eval_group(db, eval_id)
    group_id_2 = await create_test_eval_group(db, eval_id)

    data = {
        "attempt_id": str(attempt_id),
    }

    # Act
    await benchmark_runs_start_all(sid, data)

    # Assert - verify success event was emitted
    started_events = mock_sio.get_events("benchmarks_runs_start_all_started")
    assert len(started_events) == 1
    assert started_events[0]["success"] is True
    assert started_events[0]["attempt_id"] == str(attempt_id)
    assert started_events[0]["started_count"] == 2

    # Verify benchmark_next was emitted internally for each group
    next_events = mock_internal_sio.get_events("benchmark_next")
    assert len(next_events) == 2
    assert all(event["attempt_id"] == str(attempt_id) for event in next_events)
    assert all(event["use_groups"] is True for event in next_events)


async def test_benchmark_runs_start_all_missing_attempt_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test benchmark_runs_start_all with missing attempt_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    data = {}

    # Act
    await benchmark_runs_start_all(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("benchmarks_runs_start_all_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert "attempt_id is required" in error_events[0]["message"]


async def test_benchmark_runs_start_all_attempt_not_found(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test benchmark_runs_start_all with non-existent attempt_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    data = {
        "attempt_id": str(uuid.uuid4()),
    }

    # Act
    await benchmark_runs_start_all(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("benchmarks_runs_start_all_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
    assert "Attempt not found" in error_events[0]["message"]


async def test_benchmark_runs_start_all_invalid_uuid(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test benchmark_runs_start_all with invalid UUID format."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    data = {
        "attempt_id": "invalid-uuid",
    }

    # Act
    await benchmark_runs_start_all(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("benchmarks_runs_start_all_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False
